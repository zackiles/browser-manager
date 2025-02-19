/**
 * Brave Browser configuration module.
 * Provides installation and configuration settings for Brave Browser.
 * Supports Windows, macOS, and Linux platforms with version-specific downloads.
 * Downloads are fetched from GitHub releases.
 * 
 * @module browser-configs/brave-config
 */
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { getCurrentPlatform, getCurrentArch } from '../utils.ts'
import { logger } from '../logger.ts'

/** GitHub API response for a release */
interface GitHubRelease {
  /** Release tag name (e.g., 'v1.2.3') */
  tag_name: string
  /** Release name */
  name: string
  /** Release description */
  body: string
  /** Whether this is a draft release */
  draft: boolean
  /** Whether this is a prerelease */
  prerelease: boolean
  /** Release creation timestamp */
  created_at: string
  /** Release publication timestamp */
  published_at: string
}

/**
 * Configuration class for Brave Browser.
 * Handles platform-specific installation paths, download URLs, and version management.
 * Uses GitHub releases API to find and download specific Brave versions.
 * @extends BaseBrowserConfig
 */
export class BraveConfig extends BaseBrowserConfig {
  /** GitHub API endpoint for Brave releases */
  private static readonly GITHUB_API_URL = 'https://api.github.com/repos/brave/brave-browser/releases/latest'

  constructor() {
    super('Brave', {
      windows: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate:
          'https://github.com/brave/brave-browser/releases/download/v{{version}}/BraveBrowserSetup{{arch === "arm64" ? "ARM64" : ""}}.exe',
        installPathTemplate:
          '{{basePath}}\\BraveSoftware\\Brave-Browser\\Application',
        executableTemplate: '{{installPath}}\\brave.exe',
        installArgs: {
          exe: ['--silent', '--install', '--installdir={{installPath}}']
        }
      },
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate:
          'https://github.com/brave/brave-browser/releases/download/v{{version}}/Brave-Browser-{{arch}}.dmg',
        installPathTemplate: '{{basePath}}/Brave Browser.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Brave Browser',
        installArgs: {
          dmg: {
            mount: ['attach', '{{downloadedInstallerPath}}', '-mountpoint', '{{mountPoint}}', '-nobrowse', '-quiet'],
            copy: ['-R', '{{appPath}}', '{{basePath}}/Brave Browser.app'],
            unmount: ['detach', '{{mountPoint}}', '-quiet']
          }
        }
      },
      linux: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate:
          'https://github.com/brave/brave-browser/releases/download/v{{version}}/brave-browser_{{version}}_{{arch === "x64" ? "amd64" : "arm64"}}.deb',
        installPathTemplate: '{{basePath}}/bin',
        executableTemplate: '{{installPath}}/brave-browser',
        installArgs: {
          deb: ['dpkg', '-i', '{{downloadedInstallerPath}}']
        }
      },
    })
  }

  /**
   * Gets the latest available version of Brave Browser.
   * Fetches from GitHub releases API.
   * @param platform - Target platform (windows, mac, linux)
   * @param arch - Target architecture (x64, arm64)
   * @returns Promise resolving to the latest version string
   * @throws {Error} If the API request fails or no compatible release is found
   */
  override async getLatestVersion(
    platform: SupportedPlatform = getCurrentPlatform(),
    arch: SupportedArch = getCurrentArch()
  ): Promise<string> {
    return this.getCachedVersion(
      `${platform}-${arch}`,
      async () => {
        try {
          const response = await fetch(BraveConfig.GITHUB_API_URL)
          if (!response.ok) {
            throw new Error(`Failed to fetch latest Brave version: ${response.status} ${response.statusText}`)
          }

          const data = await response.json() as GitHubRelease
          if (data.draft || data.prerelease) {
            throw new Error('Latest release is a draft or prerelease')
          }

          // Remove 'v' prefix from tag name
          const version = data.tag_name.replace(/^v/, '')
          logger.debug(`Latest Brave version: ${version}`)
          return version
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          logger.error(`Error fetching Brave version: ${errorMessage}`)
          throw error
        }
      }
    )
  }
} 