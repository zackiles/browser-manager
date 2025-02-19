/**
 * Brave Browser configuration module.
 * Provides installation and configuration settings for Brave Browser.
 * Supports Windows, macOS, and Linux platforms.
 * 
 * @module browser-configs/brave-config
 */
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { getCurrentPlatform, getCurrentArch } from '../utils.ts'

export class BraveConfig extends BaseBrowserConfig {
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
   * Gets the latest available version for Brave on the specified platform and architecture
   * @param platform - Target platform
   * @param arch - Target architecture
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
        const response = await fetch(
          'https://api.github.com/repos/brave/brave-browser/releases/latest',
        )
        if (!response.ok) {
          throw new Error(`Failed to fetch Brave versions: ${response.statusText}`)
        }

        const data = await response.json()
        const version = data.tag_name.replace('v', '')
        
        // Validate platform and architecture support
        if (!this.isValidPlatform(currentPlatform)) {
          throw new Error(`Unsupported platform: ${currentPlatform}`)
        }
        if (!this.isValidArch(currentPlatform, currentArch)) {
          throw new Error(`Unsupported architecture: ${currentArch} for platform ${currentPlatform}`)
        }

        return version
      },
    )
  }
} 