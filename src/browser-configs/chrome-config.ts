import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'
import { logger } from '../logger.ts'

const VERSIONS_URL = 'https://raw.githubusercontent.com/ulixee/chrome-versions/refs/heads/main/versions.json'
type VersionsData = Record<string, { mac?: string; win?: string; linux?: string }>
let versionsCache: VersionsData | undefined

async function fetchVersionsData(): Promise<VersionsData> {
  if (versionsCache) return versionsCache

  logger.debug('Fetching Chrome versions data...')
  const response = await fetch(VERSIONS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch Chrome versions data: ${response.statusText}`)
  }

  const data = await response.json() as VersionsData
  versionsCache = data
  return data
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0
    if (part1 !== part2) return part1 - part2
  }
  return 0
}

async function findClosestVersion(
  targetVersion: string,
  platform: SupportedPlatform,
  arch: SupportedArch,
): Promise<string> {
  const versions = await fetchVersionsData()
  const platformKey = platform === 'windows' ? 'win' : platform

  // Filter versions that have a download for this platform
  const availableVersions = Object.entries(versions)
    .filter(([_, urls]) => !!urls[platformKey])
    .map(([version]) => version)
    // Special handling for M1 Macs - filter out versions before 88.0.4324.150
    .filter((version) => {
      if (platform === 'mac' && arch === 'arm64') {
        return compareVersions(version, '88.0.4324.150') >= 0
      }
      return true
    })
    .sort(compareVersions)

  if (!availableVersions.length) {
    throw new Error(`No available versions found for ${platform}/${arch}`)
  }

  // Find the closest version that's greater than or equal to the target
  const closestVersion = availableVersions.find(
    (version) => compareVersions(version, targetVersion) >= 0,
  ) || availableVersions[availableVersions.length - 1] // Fall back to latest if none found

  logger.debug(`Found closest Chrome version ${closestVersion} for requested version ${targetVersion}`)
  return closestVersion
}

export class ChromeConfig extends BaseBrowserConfig {
  constructor() {
    super('Google Chrome', {
      windows: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version: string) => {
          const matchedVersion = await findClosestVersion(version, 'windows', 'x64')
          const versions = await fetchVersionsData()
          return versions[matchedVersion].win as string
        },
        installPathTemplate: '{{basePath}}\\Google\\Chrome\\Application',
        executableTemplate: '{{installPath}}\\chrome.exe',
      },
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version: string, arch: SupportedArch) => {
          const matchedVersion = await findClosestVersion(version, 'mac', arch)
          const versions = await fetchVersionsData()
          return versions[matchedVersion].mac as string
        },
        installPathTemplate: '{{basePath}}/Google Chrome.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Google Chrome',
      },
      linux: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version: string, arch: SupportedArch) => {
          const matchedVersion = await findClosestVersion(version, 'linux', arch)
          const versions = await fetchVersionsData()
          return versions[matchedVersion].linux as string
        },
        installPathTemplate: '{{basePath}}/bin',
        executableTemplate: '{{installPath}}/google-chrome',
      },
    })
  }
} 