/**
 * Microsoft Edge browser configuration module.
 * Provides installation and configuration settings for Microsoft Edge browser.
 * Supports Windows, macOS, and Linux platforms.
 * 
 * @module browser-configs/edge-config
 */
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { getCurrentPlatform, getCurrentArch } from '../utils.ts'
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
   * Gets the latest available version of Microsoft Edge.
   * Fetches from Microsoft's Edge update API.
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
        // Microsoft's update API endpoint
        const url = 'https://edgeupdates.microsoft.com/api/products'
        
        logger.debug(`Fetching latest Edge version from: ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch latest Edge version: ${response.statusText}`)
        }

        const data = await response.json()
        const stableChannel = data.find((product: any) => 
          product.Product === 'Stable' && 
          product.Releases?.length > 0
        )

        if (!stableChannel?.Releases) {
          throw new Error('No stable releases found')
        }

        // Find the latest release for the current platform and arch
        const platformKey = currentPlatform === 'mac' ? 'Darwin' 
          : currentPlatform === 'windows' ? 'Windows' 
          : 'Linux'
        
        const release = stableChannel.Releases.find((release: any) =>
          release.Platform === platformKey &&
          (currentArch === 'arm64' ? release.Architecture === 'ARM64' : release.Architecture === 'x64')
        )

        if (!release) {
          throw new Error(`No release found for ${currentPlatform}/${currentArch}`)
        }

        logger.debug(`Latest Edge version: ${release.ProductVersion}`)
        return release.ProductVersion
      }
    )
  }
} 