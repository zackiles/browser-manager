import { BaseBrowserConfig } from '../browser-base-config.ts'

export class ArcConfig extends BaseBrowserConfig {
  constructor() {
    super('Arc Browser', {
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate: 'https://releases.arc.net/release/Arc-latest.dmg',
        installPathTemplate: '{{basePath}}/Arc.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Arc',
      },
      windows: {
        arch: ['x64'],
        downloadUrlTemplate: 'https://releases.arc.net/windows/ArcInstaller.exe',
        installPathTemplate: '{{basePath}}\\Arc',
        executableTemplate: '{{installPath}}\\Arc.exe',
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
} 