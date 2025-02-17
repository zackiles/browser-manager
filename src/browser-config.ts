import { logger } from './logger.ts'

type TemplateVariables = Record<string, string>
type SupportedPlatform = 'windows' | 'mac' | 'linux'
type SupportedArch = 'x64' | 'arm64'

interface PlatformConfig {
  readonly arch: SupportedArch[]
  readonly downloadUrlTemplate?: string
  readonly downloadUrlResolver?: (
    version: string,
    arch: SupportedArch,
  ) => Promise<string>
  readonly installPathTemplate: string
  readonly executableTemplate: string
}

interface BrowserParams {
  platform: string
  version?: string
  arch?: string
  basePath?: string
  installPath?: string
}

class BrowserConfig {
  constructor(
    public readonly name: string,
    public readonly platforms: Record<string, PlatformConfig>,
  ) {}

  isValidPlatform(platform: string): boolean {
    return this.normalizePlatform(platform) in this.platforms
  }

  isValidArch(platform: string, arch: string): boolean {
    const normalizedPlatform = this.normalizePlatform(platform)
    const config = this.platforms[normalizedPlatform]
    return config?.arch.includes(arch?.toLowerCase() as SupportedArch) ?? false
  }

  getDownloadUrl({ platform, version, arch }: BrowserParams): Promise<string> {
    const normalizedPlatform = this.normalizePlatform(platform)
    const normalizedArch = arch?.toLowerCase() as SupportedArch

    const config = this.validatePlatformConfig(
      normalizedPlatform,
      normalizedArch,
    )
    if (config.downloadUrlResolver && version && normalizedArch) {
      return config.downloadUrlResolver(version, normalizedArch)
    }
    if (!config.downloadUrlTemplate) {
      throw new Error(
        `No download configuration for ${this.name} on ${normalizedPlatform}`,
      )
    }
    return Promise.resolve(
      this.replaceTemplate(config.downloadUrlTemplate, {
        version: version ?? '',
        arch: normalizedArch ?? '',
      }),
    )
  }

  getInstallPath({ platform, basePath, version = '' }: BrowserParams): string {
    const config = this.validatePlatformConfig(this.normalizePlatform(platform))
    return this.replaceTemplate(config.installPathTemplate, {
      basePath: basePath ?? '',
      version,
    })
  }

  getExecutable({ platform, installPath }: BrowserParams): string {
    const config = this.validatePlatformConfig(this.normalizePlatform(platform))
    return this.replaceTemplate(config.executableTemplate, {
      installPath: installPath ?? '',
    })
  }

  private normalizePlatform(platform: string): SupportedPlatform {
    const normalized = platform.toLowerCase()
    return (
      ({ macos: 'mac', darwin: 'mac', win: 'windows' } as const)[normalized] ??
      (normalized as SupportedPlatform)
    )
  }

  private validatePlatformConfig(
    platform: string,
    arch?: string,
  ): PlatformConfig {
    const config = this.platforms[platform]
    if (!config) throw new Error(`Unsupported platform for ${this.name}`)
    if (arch && !config.arch.map((a) => a.toLowerCase()).includes(arch)) {
      throw new Error(`Unsupported architecture ${arch} for ${this.name}`)
    }
    return config
  }

  private replaceTemplate(template: string, vars: TemplateVariables): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in vars)) throw new Error(`Missing template variable: ${key}`)
      return vars[key]
    })
  }
}

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
  const browser = BROWSERS.chromium
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

export const BROWSERS: Record<string, BrowserConfig> = {
  chrome: new BrowserConfig('Google Chrome', {
    windows: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate:
        'https://dl.google.com/chrome/install/standalone/GoogleChromeStandaloneEnterprise64.msi?version={{version}}',
      installPathTemplate: '{{basePath}}\\Google\\Chrome\\Application',
      executableTemplate: '{{installPath}}\\chrome.exe',
    },
    mac: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate:
        'https://dl.google.com/chrome/mac/universal/stable/gcem/GoogleChrome-{{version}}.dmg',
      installPathTemplate: '{{basePath}}/Google Chrome.app/Contents/MacOS',
      executableTemplate: '{{installPath}}/Google Chrome',
    },
    linux: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate:
        'https://dl.google.com/linux/direct/google-chrome-stable_current_{{arch}}.deb',
      installPathTemplate: '{{basePath}}/bin',
      executableTemplate: '{{installPath}}/google-chrome',
    },
  }),

  chromium: new BrowserConfig('Chromium', {
    windows: {
      arch: ['x64', 'arm64'],
      downloadUrlResolver: async (version, arch) => {
        const build = await fetchChromiumBuildNumber(version, 'windows', arch)
        return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Win/${build}/chrome-win.zip`
      },
      installPathTemplate: '{{basePath}}\\Chromium',
      executableTemplate: '{{installPath}}\\chrome.exe',
    },
    mac: {
      arch: ['x64', 'arm64'],
      downloadUrlResolver: async (version, arch) => {
        const build = await fetchChromiumBuildNumber(version, 'mac', arch)
        return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Mac/${build}/chrome-mac.zip`
      },
      installPathTemplate: '{{basePath}}/Chromium.app/Contents/MacOS',
      executableTemplate: '{{installPath}}/Chromium',
    },
    linux: {
      arch: ['x64', 'arm64'],
      downloadUrlResolver: async (version, arch) => {
        const build = await fetchChromiumBuildNumber(version, 'linux', arch)
        return `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_${arch === 'arm64' ? 'arm64' : 'x64'}/${build}/chrome-linux.zip`
      },
      installPathTemplate: '{{basePath}}/bin',
      executableTemplate: '{{installPath}}/chromium',
    },
  }),

  edge: new BrowserConfig('Microsoft Edge', {
    windows: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate:
        'https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/{{version}}/MicrosoftEdgeSetup.exe',
      installPathTemplate: '{{basePath}}\\Microsoft\\Edge\\Application',
      executableTemplate: '{{installPath}}\\msedge.exe',
    },
    mac: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate:
        'https://officecdn-microsoft-com.akamaized.net/pr/C1297A47-86C4-4C1F-97FA-950631F94777/MacAutoupdate/MicrosoftEdge-{{version}}.pkg',
      installPathTemplate: '{{basePath}}/Microsoft Edge.app/Contents/MacOS',
      executableTemplate: '{{installPath}}/Microsoft Edge',
    },
    linux: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate:
        'https://packages.microsoft.com/repos/edge/pool/main/m/microsoft-edge-stable/microsoft-edge-stable_{{version}}_{{arch}}.deb',
      installPathTemplate: '{{basePath}}/bin',
      executableTemplate: '{{installPath}}/microsoft-edge',
    },
  }),

  brave: new BrowserConfig('Brave', {
    windows: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate:
        'https://referrals.brave.com/latest/BraveBrowserSetup-{{version}}.exe',
      installPathTemplate:
        '{{basePath}}\\BraveSoftware\\Brave-Browser\\Application',
      executableTemplate: '{{installPath}}\\brave.exe',
    },
    mac: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate:
        'https://referrals.brave.com/latest/BraveBrowser-{{version}}.dmg',
      installPathTemplate: '{{basePath}}/Brave Browser.app/Contents/MacOS',
      executableTemplate: '{{installPath}}/Brave Browser',
    },
    linux: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate:
        'https://brave-browser-apt-release.s3.brave.com/{{arch}}/brave-browser_{{version}}_{{arch}}.deb',
      installPathTemplate: '{{basePath}}/bin',
      executableTemplate: '{{installPath}}/brave-browser',
    },
  }),

  arc: new BrowserConfig('Arc Browser', {
    mac: {
      arch: ['x64', 'arm64'],
      downloadUrlTemplate: 'https://arc.net/download/{{version}}',
      installPathTemplate: '{{basePath}}/Arc.app/Contents/MacOS',
      executableTemplate: '{{installPath}}/Arc',
    },
  }),
}
