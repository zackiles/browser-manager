/**
 * Brave Browser configuration module.
 * Provides installation and configuration settings for Brave Browser.
 * Supports Windows, macOS, and Linux platforms.
 * 
 * @module browser-configs/brave-config
 */
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { getCurrentPlatform, getCurrentArch } from '../utils.ts'
import { logger } from '../logger.ts'

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
   * Gets the latest available version of Brave Browser.
   * Fetches from GitHub releases API.
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
        const response = await fetch('https://api.github.com/repos/brave/brave-browser/releases/latest')
        if (!response.ok) {
          throw new Error(`Failed to fetch latest Brave version: ${response.statusText}`)
        }

        const data = await response.json()
        // Remove 'v' prefix from tag name
        const version = data.tag_name.replace(/^v/, '')
        logger.debug(`Latest Brave version: ${version}`)
        return version
      }
    )
  }
} 