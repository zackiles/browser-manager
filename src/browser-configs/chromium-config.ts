import { logger } from '../logger.ts'
import { BaseBrowserConfig, type SupportedPlatform, type SupportedArch } from '../browser-base-config.ts'

function getChromiumPlatform(
  platform: SupportedPlatform,
  arch: SupportedArch,
): string {
  if (platform === 'linux') return `Linux_${arch}`
  return platform === 'windows' ? 'Win' : 'Mac'
}

async function fetchChromiumBuildNumber(
  version: string,
  platform: SupportedPlatform,
  arch: SupportedArch,
): Promise<string> {
  const browser = new ChromiumConfig()
  if (!browser.isValidPlatform(platform))
    throw new Error(`Unsupported platform: ${platform}`)
  if (!browser.isValidArch(platform, arch))
    throw new Error(`Unsupported architecture: ${arch}`)

  const chromiumPlatform = getChromiumPlatform(platform, arch)
  logger.debug(
    `Searching for Chromium build number for ${version} on ${platform}/${arch}...`,
  )

  const baseUrl = 'https://chromiumdash.appspot.com/fetch_releases'
  const numResults = 50
  let offsetLow = 0
  let offsetHigh = 450

  const fetchReleases = async (offset: number) => {
    const url = new URL(baseUrl)
    url.searchParams.set('channel', 'Stable')
    url.searchParams.set('platform', chromiumPlatform)
    url.searchParams.set('num', numResults.toString())
    url.searchParams.set('offset', offset.toString())

    logger.debug(`Searching page: ${url.href}`)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`Failed to fetch releases from ${url.href}`)

    return response.json() as Promise<
      { version: string; chromium_main_branch_position: number }[]
    >
  }

  while (offsetLow < offsetHigh) {
    const midOffset = Math.floor((offsetLow + offsetHigh) / 2)
    const data = await fetchReleases(midOffset)
    if (!data.length) {
      offsetHigh = midOffset
      continue
    }

    const [newestVersion, oldestVersion] = [
      data[0].version,
      data[data.length - 1].version,
    ]
    if (newestVersion < version) {
      offsetHigh = midOffset
    } else if (oldestVersion > version) {
      offsetLow = midOffset + numResults
    } else {
      offsetLow = midOffset
      break
    }
  }

  for (let offset = offsetLow; ; offset += numResults) {
    const data = await fetchReleases(offset)
    if (!data.length) break

    const match = data.find((release) => release.version === version)
    if (match) {
      logger.debug(`Found release for ${version} on ${platform}/${arch}!`)
      logger.debug(`Finding closest build snapshot for version ${version}...`)
      return findNearestAvailableBuild(
        platform,
        arch,
        match.chromium_main_branch_position.toString(),
      )
    }
  }

  throw new Error(`No build found for version ${version}`)
}

async function findNearestAvailableBuild(
  platform: SupportedPlatform,
  arch: SupportedArch,
  buildNumber: string,
): Promise<string> {
  const maxAttempts = 5
  const currentBuild = Number.parseInt(buildNumber, 10)
  const chromiumPlatform = getChromiumPlatform(platform, arch)

  for (let i = 0; i < maxAttempts; i++) {
    const [testBuildUp, testBuildDown] = [
      (currentBuild + i).toString(),
      (currentBuild - i).toString(),
    ]

    const testUrls = [testBuildUp, testBuildDown].map(
      (build) =>
        `https://commondatastorage.googleapis.com/chromium-browser-snapshots/${chromiumPlatform}/${build}/chrome-${platform === 'windows' ? 'win' : platform}.zip`,
    )

    for (const testUrl of testUrls) {
      const response = await fetch(testUrl, { method: 'HEAD' })
      if (response.ok) {
        const closestBuild = testUrl.split('/').slice(-2, -1)[0]
        logger.debug(
          `Found closest build snapshot for ${buildNumber} which is ${closestBuild}`,
        )
        return closestBuild
      }
    }
  }

  throw new Error(
    `No valid build found near ${buildNumber} for ${platform}/${arch}`,
  )
}

export class ChromiumConfig extends BaseBrowserConfig {
  constructor() {
    super('Chromium', {
      windows: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version, arch: SupportedArch) => {
          const build = await fetchChromiumBuildNumber(version, 'windows', arch)
          return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Win/${build}/chrome-win.zip`
        },
        installPathTemplate: '{{basePath}}\\Chromium',
        executableTemplate: '{{installPath}}\\chrome.exe',
      },
      mac: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version, arch: SupportedArch) => {
          const build = await fetchChromiumBuildNumber(version, 'mac', arch)
          return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Mac/${build}/chrome-mac.zip`
        },
        installPathTemplate: '{{basePath}}/Chromium.app/Contents/MacOS',
        executableTemplate: '{{installPath}}/Chromium',
      },
      linux: {
        arch: ['x64', 'arm64'],
        downloadUrlResolver: async (version, arch: SupportedArch) => {
          const build = await fetchChromiumBuildNumber(version, 'linux', arch)
          return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_${arch === 'arm64' ? 'arm64' : 'x64'}/${build}/chrome-linux.zip`
        },
        installPathTemplate: '{{basePath}}/bin',
        executableTemplate: '{{installPath}}/chromium',
      },
    })
  }
} 