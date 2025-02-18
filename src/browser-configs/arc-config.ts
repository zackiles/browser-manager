import { BaseBrowserConfig } from '../browser-base-config.ts'

export class ArcConfig extends BaseBrowserConfig {
  constructor() {
    super('Arc Browser', {
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate: 'https://arc.net/download/{{version}}',
        installPathTemplate: '{{basePath}}/Arc.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Arc',
      },
    })
  }
} 