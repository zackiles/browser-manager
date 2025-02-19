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

/** Edge release information from Microsoft's API */
interface EdgeRelease {
  /** Version number of the release */
  ProductVersion: string
  /** Platform this release is for */
  Platform: string
  /** Architecture this release supports */
  Architecture: string
  /** Available artifacts for download */
  Artifacts: Array<{
    /** Name of the artifact */
    ArtifactName: string
    /** Download location URL */
    Location: string
    /** Hash for verification */
    Hash: string
  }>
}

/** Edge product information from Microsoft's API */
interface EdgeProduct {
  /** Product channel (e.g., 'Stable', 'Beta') */
  Product: string
  /** Available releases for this product */
  Releases: EdgeRelease[]
}

export class EdgeConfig extends BaseBrowserConfig {
  /** Microsoft Edge update API endpoint */
  private static readonly UPDATE_API_URL = 'https://edgeupdates.microsoft.com/api/products'

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
   * @throws {Error} If the API request fails or no compatible release is found
   */
  override async getLatestVersion(
    platform: SupportedPlatform = getCurrentPlatform(),
    arch: SupportedArch = getCurrentArch()
  ): Promise<string> {
    return this.getCachedVersion(
      `${platform}-${arch}`,
      async () => {
        try {
          logger.debug(`Fetching latest Edge version from: ${EdgeConfig.UPDATE_API_URL}`)
          const response = await fetch(EdgeConfig.UPDATE_API_URL)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch latest Edge version: ${response.status} ${response.statusText}`)
          }

          const data = await response.json()
          const stableChannel = data.find((product: EdgeProduct) => 
            product.Product === 'Stable' && 
            product.Releases?.length > 0
          )

          if (!stableChannel?.Releases) {
            throw new Error('No stable releases found in Edge update API response')
          }

          const platformKey = this.getPlatformKey(platform)
          const release = this.findCompatibleRelease(stableChannel.Releases, platformKey, arch)

          if (!release) {
            throw new Error(`No compatible Edge release found for ${platform}/${arch}`)
          }

          logger.debug(`Latest Edge version: ${release.ProductVersion}`)
          return release.ProductVersion
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          logger.error(`Error fetching Edge version: ${errorMessage}`)
          throw error
        }
      }
    )
  }

  /**
   * Converts platform to Microsoft's platform key format
   * @param platform - Target platform
   * @returns Platform key used in Microsoft's API
   * @private
   */
  private getPlatformKey(platform: SupportedPlatform): string {
    return platform === 'mac' ? 'Darwin' 
      : platform === 'windows' ? 'Windows' 
      : 'Linux'
  }

  /**
   * Finds a compatible release for the given platform and architecture
   * @param releases - Available releases
   * @param platformKey - Platform key (Darwin, Windows, Linux)
   * @param arch - Target architecture
   * @returns Compatible release or undefined if none found
   * @private
   */
  private findCompatibleRelease(
    releases: EdgeRelease[],
    platformKey: string,
    arch: SupportedArch
  ): EdgeRelease | undefined {
    return releases.find(release =>
      release.Platform === platformKey &&
      (arch === 'arm64' ? release.Architecture === 'ARM64' : release.Architecture === 'x64')
    )
  }
} 