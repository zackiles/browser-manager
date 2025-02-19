/**
 * Arc Browser configuration module.
 * Provides installation and configuration settings for Arc Browser.
 * Currently supports macOS and Windows platforms.
 * 
 * @module browser-configs/arc-config
 */
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { logger } from '../logger.ts'
import { getCurrentPlatform, getCurrentArch } from '../utils.ts'

export class ArcConfig extends BaseBrowserConfig {
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

  override async getDownloadUrl({ platform, version }: { platform: string; version?: string }): Promise<string> {
    if (version) {
      throw new Error('Arc Browser only supports downloading the latest version. Do not specify a version parameter.')
    }

    const normalizedPlatform = this.normalizePlatform(platform)
    if (!['mac', 'windows'].includes(normalizedPlatform)) {
      throw new Error('Arc Browser is only supported on macOS and Windows.')
    }

    return super.getDownloadUrl({ platform })
  }

  /**
   * Gets the latest available version for Arc browser
   * @param platform - Target platform
   * @param arch - Target architecture
   * @returns Promise resolving to 'latest' since Arc only supports latest version
   * @throws Error if platform is not supported
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
        const normalizedPlatform = this.normalizePlatform(currentPlatform)
        if (!['mac', 'windows'].includes(normalizedPlatform)) {
          throw new Error('Arc Browser is only supported on macOS and Windows.')
        }

        if (normalizedPlatform === 'windows' && currentArch !== 'x64') {
          throw new Error('Arc Browser on Windows only supports x64 architecture.')
        }

        logger.debug(`Arc Browser always uses 'latest' version`)
        return 'latest'
      }
    )
  }
} 