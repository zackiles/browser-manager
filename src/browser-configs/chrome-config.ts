/**
 * Google Chrome browser configuration.
 * Provides installation and configuration settings for Google Chrome browser.
 * Supports Windows, macOS, and Linux platforms with version-specific downloads.
 * 
 * @module browser-configs/chrome-config
 */
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { logger } from '../logger.ts'
import { getCurrentPlatform, getCurrentArch } from '../utils.ts'

/** URL for fetching Chrome version data */
const VERSIONS_URL = 'https://raw.githubusercontent.com/ulixee/chrome-versions/refs/heads/main/versions.json'

/** Type definition for Chrome version data structure */
interface VersionsData {
  /** Version number mapped to platform-specific download URLs */
  [version: string]: {
    /** macOS download URL */
    mac?: string
    /** Windows download URL */
    win?: string
    /** Linux download URL */
    linux?: string
  }
}

/** Cache for version data to reduce API calls */
let versionsCache: VersionsData | undefined

/**
 * Fetches and caches Chrome version data from the versions repository.
 * @returns Promise resolving to version data mapping
 * @throws {Error} If fetching version data fails
 */
async function fetchVersionsData(): Promise<VersionsData> {
  if (versionsCache) return versionsCache

  logger.debug('Fetching Chrome versions data...')
  const response = await fetch(VERSIONS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch Chrome versions data: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as VersionsData
  versionsCache = data
  return data
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
 * Finds the closest available Chrome version for the given target version.
 * @param targetVersion - Desired Chrome version
 * @param platform - Target platform
 * @param arch - Target architecture
 * @returns Promise resolving to the closest available version
 * @throws {Error} If no suitable version is found
 */
async function findClosestVersion(
  targetVersion: string,
  platform: SupportedPlatform,
  arch: SupportedArch,
): Promise<string> {
  const versions = await fetchVersionsData()
  const platformKey = platform === 'windows' ? 'win' : platform

  // Filter versions that have a download for this platform
  const availableVersions = Object.entries(versions)
    .filter(([_, urls]) => !!urls[platformKey])
    .map(([version]) => version)
    // Special handling for M1 Macs - filter out versions before 88.0.4324.150
    .filter((version) => {
      if (platform === 'mac' && arch === 'arm64') {
        return compareVersions(version, '88.0.4324.150') >= 0
      }
      return true
    })
    .sort(compareVersions)

  if (!availableVersions.length) {
    throw new Error(`No available versions found for ${platform}/${arch}`)
  }

  // Find the closest version that's greater than or equal to the target
  const closestVersion = availableVersions.find(
    (version) => compareVersions(version, targetVersion) >= 0,
  ) || availableVersions[availableVersions.length - 1] // Fall back to latest if none found

  logger.debug(`Found closest Chrome version ${closestVersion} for requested version ${targetVersion}`)
  return closestVersion
}

/**
 * Configuration class for Google Chrome browser.
 * Handles platform-specific installation paths, download URLs, and version management.
 * Uses a version repository to find and download specific Chrome versions.
 * @extends BaseBrowserConfig
 */
export class ChromeConfig extends BaseBrowserConfig {
  /** Minimum version that supports arm64 on macOS */
  private static readonly MIN_MAC_ARM64_VERSION = '88.0.4324.150'

  constructor() {
    super('Google Chrome', {
      windows: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version: string) => {
          const matchedVersion = await findClosestVersion(version, 'windows', 'x64')
          const versions = await fetchVersionsData()
          return versions[matchedVersion].win as string
        },
        installPathTemplate: '{{basePath}}\\Google\\Chrome\\Application',
        executableTemplate: '{{installPath}}\\chrome.exe',
        installArgs: {
          exe: ['/silent', '/install', '/installsource=browser-manager', '/installdir={{installPath}}']
        }
      },
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version: string, arch: SupportedArch) => {
          const matchedVersion = await findClosestVersion(version, 'mac', arch)
          const versions = await fetchVersionsData()
          return versions[matchedVersion].mac as string
        },
        installPathTemplate: '{{basePath}}/Google Chrome.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Google Chrome',
        installArgs: {
          dmg: {
            mount: ['attach', '{{downloadedInstallerPath}}', '-mountpoint', '{{mountPoint}}', '-nobrowse', '-quiet'],
            copy: ['-R', '{{appPath}}', '{{basePath}}/Google Chrome.app'],
            unmount: ['detach', '{{mountPoint}}', '-quiet']
          }
        }
      },
      linux: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version: string, arch: SupportedArch) => {
          const matchedVersion = await findClosestVersion(version, 'linux', arch)
          const versions = await fetchVersionsData()
          return versions[matchedVersion].linux as string
        },
        installPathTemplate: '{{basePath}}/bin',
        executableTemplate: '{{installPath}}/google-chrome',
        installArgs: {
          deb: ['dpkg', '-i', '{{downloadedInstallerPath}}']
        }
      },
    })
  }

  /**
   * Gets the latest available version of Google Chrome.
   * Fetches from Chrome's version repository.
   * @param platform - Target platform (windows, mac, linux)
   * @param arch - Target architecture (x64, arm64)
   * @returns Promise resolving to the latest version string
   * @throws {Error} If version data cannot be fetched or no compatible version is found
   */
  override async getLatestVersion(
    platform: SupportedPlatform = getCurrentPlatform(),
    arch: SupportedArch = getCurrentArch()
  ): Promise<string> {
    return this.getCachedVersion(
      `${platform}-${arch}`,
      async () => {
        try {
          const versions = await fetchVersionsData()
          const latestVersion = Object.keys(versions)[0]
          
          // Validate version compatibility
          if (platform === 'mac' && arch === 'arm64' && 
              compareVersions(latestVersion, ChromeConfig.MIN_MAC_ARM64_VERSION) < 0) {
            throw new Error(`Chrome version ${latestVersion} does not support arm64 on macOS`)
          }
          
          logger.debug(`Latest Chrome version: ${latestVersion}`)
          return latestVersion
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          logger.error(`Error fetching Chrome version: ${errorMessage}`)
          throw error
        }
      }
    )
  }
} 