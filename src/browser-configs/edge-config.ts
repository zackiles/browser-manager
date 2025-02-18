/**
 * Microsoft Edge configuration module.
 * Provides installation and configuration settings for Microsoft Edge.
 * Supports Windows, macOS, and Linux platforms.
 * 
 * @module browser-configs/edge-config
 */
import { BaseBrowserConfig } from '../browser-base-config.ts'

export class EdgeConfig extends BaseBrowserConfig {
  constructor() {
    super('Microsoft Edge', {
      windows: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate:
          'https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/{{version}}/MicrosoftEdgeSetup.exe',
        installPathTemplate: '{{basePath}}\\Microsoft\\Edge\\Application',
        executableTemplate: '{{installPath}}\\msedge.exe',
        installArgs: {
          exe: ['/silent', '/install', '/system-level', '/installdir={{installPath}}']
        }
      },
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate:
          'https://officecdn-microsoft-com.akamaized.net/pr/C1297A47-86C4-4C1F-97FA-950631F94777/MacAutoupdate/MicrosoftEdge-{{version}}.pkg',
        installPathTemplate: '{{basePath}}/Microsoft Edge.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Microsoft Edge',
        installArgs: {
          pkg: ['-pkg', '{{downloadedInstallerPath}}', '-target', '/']
        }
      },
      linux: {
        arch: ['x64', 'arm64'],
        downloadUrlTemplate:
          'https://packages.microsoft.com/repos/edge/pool/main/m/microsoft-edge-stable/microsoft-edge-stable_{{version}}_{{arch}}.deb',
        installPathTemplate: '{{basePath}}/bin',
        executableTemplate: '{{installPath}}/microsoft-edge',
        installArgs: {
          deb: ['dpkg', '-i', '{{downloadedInstallerPath}}']
        }
      },
    })
  }
} 