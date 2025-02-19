/**
 * Microsoft Edge configuration module.
 * Provides installation and configuration settings for Microsoft Edge.
 * Supports Windows, macOS, and Linux platforms.
 * 
 * @module browser-configs/edge-config
 */
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { getCurrentPlatform, getCurrentArch } from '../utils.ts'

interface EdgeRelease {
  ProductVersion: string
  Artifacts: Array<{
    ArtifactName: string
    Location: string
    Hash: string
  }>
}

interface EdgeProduct {
  Product: string
  Releases: EdgeRelease[]
}

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

  /**
   * Gets the latest available version for Edge on the specified platform and architecture
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
          'https://edgeupdates.microsoft.com/api/products',
        )
        if (!response.ok) {
          throw new Error(`Failed to fetch Edge versions: ${response.statusText}`)
        }

        const data = await response.json()
        const stableChannel = data.find((p: { Product: string }) =>
          p.Product === 'Stable',
        )
        if (!stableChannel) {
          throw new Error('No stable channel found')
        }

        const platformKey = currentPlatform === 'mac' ? 'MacOS' :
          currentPlatform === 'windows' ? 'Windows' : 'Linux'
        const release = stableChannel.Releases.find((r: EdgeRelease) =>
          r.Artifacts.some((a) =>
            a.ArtifactName.includes(platformKey) &&
            (currentArch === 'arm64' ? a.ArtifactName.includes('arm64') : !a.ArtifactName.includes('arm64'))
          ),
        )

        if (!release) {
          throw new Error(`No release found for ${currentPlatform}/${currentArch}`)
        }

        return release.ProductVersion
      },
    )
  }
} 