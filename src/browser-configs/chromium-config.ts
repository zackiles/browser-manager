/**
 * Chromium browser configuration.
 * Provides installation and configuration settings for Chromium browser.
 * Supports Windows, macOS, and Linux platforms.
 * 
 * @module browser-configs/chromium-config
 */
import { logger } from '../logger.ts'
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { getCurrentPlatform, getCurrentArch } from '../utils.ts'

/**
 * Maps platform and architecture to Chromium's platform identifier.
 * @param platform - Target platform
 * @param arch - Target architecture
 * @returns Platform identifier used in Chromium's API
 */
function getChromiumPlatform(
  platform: SupportedPlatform,
  arch: SupportedArch,
): string {
  if (platform === 'linux') return `Linux_${arch}`
  return platform === 'windows' ? 'Win' : 'Mac'
}

/**
 * Compares two version strings in semantic versioning format.
 * @param v1 - First version string
 * @param v2 - Second version string
 * @returns Negative if v1 < v2, positive if v1 > v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0
    if (part1 !== part2) return part1 - part2
  }
  return 0
}

/**
 * Fetches the Chromium build number for a specific version.
 * @param version - Target Chromium version
 * @param platform - Target platform
 * @param arch - Target architecture
 * @returns Promise resolving to the build number
 * @throws Error if build number cannot be found
 */
async function fetchChromiumBuildNumber(
  version: string,
  platform: SupportedPlatform,
  arch: SupportedArch,
): Promise<string> {
  const browser = new ChromiumConfig()
  if (!browser.isValidPlatform(platform))
    throw new Error(`Unsupported platform: ${platform}`)
  if (!browser.isValidArch(platform, arch))
    throw new Error(`Unsupported architecture: ${arch}`)

  const chromiumPlatform = getChromiumPlatform(platform, arch)
  logger.debug(
    `Searching for Chromium build number for ${version} on ${platform}/${arch}...`,
  )

  const baseUrl = 'https://chromiumdash.appspot.com/fetch_releases'
  const numResults = 50

  // First, try a direct fetch to see if the version is in recent releases
  const recentReleases = await fetchReleases(0)
  const recentMatch = recentReleases.find(release => release.version === version)
  if (recentMatch) {
    logger.debug(`Found release for ${version} in recent releases!`)
    return findNearestAvailableBuild(
      platform,
      arch,
      recentMatch.chromium_main_branch_position.toString(),
    )
  }

  // If not found in recent releases, do a paginated search
  let offset = 0
  const maxOffset = 1000 // Limit how far back we search

  while (offset < maxOffset) {
    const releases = await fetchReleases(offset)
    if (!releases.length) break

    const match = releases.find(release => release.version === version)
    if (match) {
      logger.debug(`Found release for ${version} on ${platform}/${arch}!`)
      return findNearestAvailableBuild(
        platform,
        arch,
        match.chromium_main_branch_position.toString(),
      )
    }

    // Check if we've gone too far back
    const oldestInBatch = releases[releases.length - 1]
    if (compareVersions(oldestInBatch.version, version) < 0) {
      break // We've gone past our target version
    }

    offset += numResults
  }

  throw new Error(`No build found for version ${version}`)

  /**
   * Helper function to fetch a page of releases.
   * @param offset - Offset for pagination
   * @returns Promise resolving to array of release data
   */
  async function fetchReleases(offset: number) {
    const url = new URL(baseUrl)
    url.searchParams.set('channel', 'Stable')
    url.searchParams.set('platform', chromiumPlatform)
    url.searchParams.set('num', numResults.toString())
    url.searchParams.set('offset', offset.toString())

    logger.debug(`Searching page: ${url.href}`)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`Failed to fetch releases from ${url.href}`)

    return response.json() as Promise<
      { version: string; chromium_main_branch_position: number }[]
    >
  }
}

/**
 * Gets the download URL for a specific build number.
 * @param platform - Target platform
 * @param arch - Target architecture
 * @param buildNumber - Build number to get URL for
 * @returns The download URL for the specified build
 */
function getDownloadUrl(platform: SupportedPlatform, arch: SupportedArch, buildNumber: string): string {
  const chromiumPlatform = getChromiumPlatform(platform, arch)
  return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/${chromiumPlatform}/${buildNumber}/chrome-${platform === 'windows' ? 'win' : platform}.zip`
}

/**
 * Finds the nearest available build number that has a downloadable snapshot.
 * @param platform - Target platform
 * @param arch - Target architecture
 * @param buildNumber - Initial build number to search around
 * @returns Promise resolving to the nearest available build number
 * @throws Error if no valid build is found within the search range
 */
async function findNearestAvailableBuild(
  platform: SupportedPlatform,
  arch: SupportedArch,
  buildNumber: string,
): Promise<string> {
  const maxAttempts = 5
  const currentBuild = Number.parseInt(buildNumber, 10)

  for (let i = 0; i < maxAttempts; i++) {
    const [testBuildUp, testBuildDown] = [
      (currentBuild + i).toString(),
      (currentBuild - i).toString(),
    ]

    const testUrls = [testBuildUp, testBuildDown].map(
      (build) => getDownloadUrl(platform, arch, build)
    )

    for (const testUrl of testUrls) {
      const response = await fetch(testUrl, { method: 'HEAD' })
      if (response.ok) {
        const closestBuild = testUrl.split('/').slice(-2, -1)[0]
        logger.debug(
          `Found closest build snapshot for ${buildNumber} which is ${closestBuild}`,
        )
        return closestBuild
      }
    }
  }

  throw new Error(
    `No valid build found near ${buildNumber} for ${platform}/${arch}`,
  )
}

/**
 * Configuration class for Chromium browser.
 * Handles platform-specific installation paths, download URLs, and version management.
 * Uses the Chromium Continuous Build API for version and download management.
 * @extends BaseBrowserConfig
 */
export class ChromiumConfig extends BaseBrowserConfig {
  constructor() {
    super('chromium', {
      windows: {
        arch: ['x64'],
        downloadUrlResolver: async (version: string) => {
          const buildNumber = await fetchChromiumBuildNumber(version, 'windows', 'x64')
          return getDownloadUrl('windows', 'x64', buildNumber)
        },
        installPathTemplate: '{{basePath}}\\Chromium\\Application',
        executableTemplate: '{{installPath}}\\chrome.exe'
      },
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version: string, arch: SupportedArch) => {
          const buildNumber = await fetchChromiumBuildNumber(version, 'mac', arch)
          return getDownloadUrl('mac', arch, buildNumber)
        },
        installPathTemplate: '{{basePath}}/Chromium.app',
        executableTemplate: '{{installPath}}/Contents/MacOS/Chromium'
      },
      linux: {
        arch: ['x64'],
        downloadUrlResolver: async (version: string) => {
          const buildNumber = await fetchChromiumBuildNumber(version, 'linux', 'x64')
          return getDownloadUrl('linux', 'x64', buildNumber)
        },
        installPathTemplate: '/usr/local/chromium',
        executableTemplate: '{{installPath}}/chrome'
      }
    })
  }

  /**
   * Gets the latest available version of Chromium.
   * Uses the Chromium API to fetch the latest stable version.
   * @param platform - Target platform (windows, mac, linux)
   * @param arch - Target architecture (x64, arm64)
   * @returns Promise resolving to the latest version string
   */
  override async getLatestVersion(
    platform?: SupportedPlatform,
    arch?: SupportedArch
  ): Promise<string> {
    const currentPlatform = platform ?? getCurrentPlatform()
    const currentArch = arch ?? getCurrentArch()
    
    return this.getCachedVersion(
      `${currentPlatform}-${currentArch}`,
      async () => {
        const chromiumPlatform = getChromiumPlatform(currentPlatform, currentArch)
        const url = 'https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=' + chromiumPlatform + '&num=1'
        
        logger.debug(`Fetching latest Chromium version from: ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch latest Chromium version: ${response.statusText}`)
        }

        const data = await response.json()
        if (!data.length) {
          throw new Error(`No versions found for ${currentPlatform}/${currentArch}`)
        }

        logger.debug(`Latest Chromium version: ${data[0].version}`)
        return data[0].version
      }
    )
  }

  /**
   * Gets the platform key used in Chromium's download URLs.
   * @param platform - Target platform
   * @param arch - Target architecture
   * @returns Platform key string used in Chromium's storage URLs
   * @private
   */
  private getPlatformKey(platform: SupportedPlatform, arch: SupportedArch): string {
    switch (platform) {
      case 'windows':
        return 'Win_x64'
      case 'mac':
        return arch === 'arm64' ? 'Mac_Arm' : 'Mac'
      case 'linux':
        return 'Linux_x64'
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }
} 