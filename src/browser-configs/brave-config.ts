import { BaseBrowserConfig } from '../browser-base-config.ts'

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
      },
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate:
          'https://github.com/brave/brave-browser/releases/download/v{{version}}/Brave-Browser-{{arch}}.dmg',
        installPathTemplate: '{{basePath}}/Brave Browser.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Brave Browser',
      },
      linux: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate:
          'https://github.com/brave/brave-browser/releases/download/v{{version}}/brave-browser_{{version}}_{{arch === "x64" ? "amd64" : "arm64"}}.deb',
        installPathTemplate: '{{basePath}}/bin',
        executableTemplate: '{{installPath}}/brave-browser',
      },
    })
  }
} 