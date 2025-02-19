/**
 * Arc Browser configuration module.
 * Provides installation and configuration settings for Arc Browser.
 * Currently supports macOS and Windows platforms.
 * 
 * @module browser-configs/arc-config
 */
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch, type BrowserParams } from '../browser-base-config.ts'
import { logger } from '../logger.ts'
import { getCurrentPlatform, getCurrentArch } from '../utils.ts'

/**
 * Configuration class for Arc Browser.
 * Handles platform-specific installation paths, download URLs, and version management.
 * @extends BaseBrowserConfig
 */
export class ArcConfig extends BaseBrowserConfig {
  /** Supported platforms for Arc Browser */
  private static readonly SUPPORTED_PLATFORMS = ['mac', 'windows'] as const

  constructor() {
    super('Arc Browser', {
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate: 'https://releases.arc.net/release/Arc-latest.dmg',
        installPathTemplate: '{{basePath}}/Arc.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Arc',
        installArgs: {
          dmg: {
            mount: ['attach', '{{downloadedInstallerPath}}', '-mountpoint', '{{mountPoint}}', '-nobrowse', '-quiet'],
            copy: ['-R', '{{appPath}}', '{{basePath}}/Arc.app'],
            unmount: ['detach', '{{mountPoint}}', '-quiet']
          }
        }
      },
      windows: {
        arch: ['x64'],
        downloadUrlTemplate: 'https://releases.arc.net/windows/ArcInstaller.exe',
        installPathTemplate: '{{basePath}}\\Arc',
        executableTemplate: '{{installPath}}\\Arc.exe',
        installArgs: {
          exe: ['--silent', '--install', '--installdir={{installPath}}']
        }
      },
    })
  }

  /**
   * Gets the latest available version of Arc Browser.
   * Arc Browser only supports 'latest' as a version.
   * @param platform - Target platform (mac, windows)
   * @param _arch - Target architecture (unused as Arc auto-detects)
   * @returns Promise resolving to 'latest' as version string
   * @throws {Error} If platform is not supported
   */
  override async getLatestVersion(
    platform: SupportedPlatform = getCurrentPlatform(),
    _arch: SupportedArch = getCurrentArch()
  ): Promise<string> {
    if (!ArcConfig.SUPPORTED_PLATFORMS.includes(platform as typeof ArcConfig.SUPPORTED_PLATFORMS[number])) {
      throw new Error('Arc Browser is only supported on macOS and Windows.')
    }

    return Promise.resolve('latest')
  }

  /**
   * Gets the download URL for Arc Browser.
   * Arc Browser only supports downloading the latest version.
   * @param params - Browser parameters including platform
   * @returns Promise resolving to the download URL
   * @throws {Error} If version is specified or platform is not supported
   */
  override async getDownloadUrl(params: BrowserParams): Promise<string> {
    if (params.version) {
      throw new Error('Arc Browser only supports downloading the latest version. Do not specify a version parameter.')
    }

    try {
      const { platform } = await this.getNormalizedParams(params)
      
      if (!ArcConfig.SUPPORTED_PLATFORMS.includes(platform as typeof ArcConfig.SUPPORTED_PLATFORMS[number])) {
        throw new Error('Arc Browser is only supported on macOS and Windows.')
      }

      return super.getDownloadUrl({ platform })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Error getting Arc Browser download URL: ${errorMessage}`)
      throw error
    }
  }
} 