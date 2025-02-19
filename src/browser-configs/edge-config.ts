/**
 * Microsoft Edge configuration module.
 * Provides installation and configuration settings for Microsoft Edge.
 * Supports Windows, macOS, and Linux platforms.
 * 
 * @module browser-configs/edge-config
 */
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { logger } from '../logger.ts'

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
    platform: SupportedPlatform,
    arch: SupportedArch
  ): Promise<string> {
    return this.getCachedVersion(
      `${platform}-${arch}`,
      async () => {
        const normalizedPlatform = this.normalizePlatform(platform)
        const updateUrl = new URL('https://edgeupdates.microsoft.com/api/products')

        // Map platform to Edge's platform names
        const edgePlatform = normalizedPlatform === 'mac' 
          ? 'MacOS' 
          : normalizedPlatform === 'windows'
            ? 'Windows'
            : 'Linux'

        updateUrl.searchParams.set('platform', edgePlatform)
        updateUrl.searchParams.set('channel', 'Stable')

        logger.debug(`Fetching latest Edge version for ${platform}/${arch}...`)
        const response = await fetch(updateUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'browser-manager'
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch Edge version: ${response.statusText}`)
        }

        const products = await response.json() as EdgeProduct[]
        const stableProduct = products.find(p => p.Product === 'Stable')
        if (!stableProduct || !stableProduct.Releases.length) {
          throw new Error(`No stable Edge releases found for ${platform}/${arch}`)
        }

        // Get the latest release
        const latestRelease = stableProduct.Releases[0]
        logger.debug(`Latest Edge version for ${platform}/${arch}: ${latestRelease.ProductVersion}`)
        return latestRelease.ProductVersion
      }
    )
  }
} 