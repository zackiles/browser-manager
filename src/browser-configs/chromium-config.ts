/**
 * Chromium configuration module.
 * Provides installation and configuration settings for Chromium.
 * Supports Windows, macOS, and Linux platforms with dynamic build number resolution.
 * 
 * Note: Unlike other browsers, Chromium is distributed as ZIP archives that are
 * extracted directly to the installation path, rather than using platform-specific
 * installers. This is why no installArgs are specified in the configuration.
 * 
 * @module browser-configs/chromium-config
 */
import { logger } from '../logger.ts'
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'

function getChromiumPlatform(
  platform: SupportedPlatform,
  arch: SupportedArch,
): string {
  if (platform === 'linux') return `Linux_${arch}`
  return platform === 'windows' ? 'Win' : 'Mac'
}

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

async function findNearestAvailableBuild(
  platform: SupportedPlatform,
  arch: SupportedArch,
  buildNumber: string,
): Promise<string> {
  const maxAttempts = 5
  const currentBuild = Number.parseInt(buildNumber, 10)
  const chromiumPlatform = getChromiumPlatform(platform, arch)

  for (let i = 0; i < maxAttempts; i++) {
    const [testBuildUp, testBuildDown] = [
      (currentBuild + i).toString(),
      (currentBuild - i).toString(),
    ]

    const testUrls = [testBuildUp, testBuildDown].map(
      (build) =>
        `https://commondatastorage.googleapis.com/chromium-browser-snapshots/${chromiumPlatform}/${build}/chrome-${platform === 'windows' ? 'win' : platform}.zip`,
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

export class ChromiumConfig extends BaseBrowserConfig {
  constructor() {
    super('Chromium', {
      windows: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version, arch: SupportedArch) => {
          const build = await fetchChromiumBuildNumber(version, 'windows', arch)
          return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Win/${build}/chrome-win.zip`
        },
        installPathTemplate: '{{basePath}}\\Chromium',
        executableTemplate: '{{installPath}}\\chrome.exe',
      },
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version, arch: SupportedArch) => {
          const build = await fetchChromiumBuildNumber(version, 'mac', arch)
          return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Mac/${build}/chrome-mac.zip`
        },
        installPathTemplate: '{{basePath}}/Chromium.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Chromium',
      },
      linux: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version, arch: SupportedArch) => {
          const build = await fetchChromiumBuildNumber(version, 'linux', arch)
          return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_${arch === 'arm64' ? 'arm64' : 'x64'}/${build}/chrome-linux.zip`
        },
        installPathTemplate: '{{basePath}}/bin',
        executableTemplate: '{{installPath}}/chromium',
      },
    })
  }
} 