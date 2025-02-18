export type TemplateVariables = Record<string, string>

// Define the supported platforms and architectures based on what's used across all browser configs
export type SupportedPlatform = 'windows' | 'mac' | 'linux'
export type SupportedArch = 'x64' | 'arm64'

export interface PlatformConfig {
  readonly arch: SupportedArch[]
  readonly downloadUrlTemplate?: string
  readonly downloadUrlResolver?: (
    version: string,
    arch: SupportedArch,
  ) => Promise<string>
  readonly installPathTemplate: string
  readonly executableTemplate: string
}

export interface BrowserParams {
  platform: string
  version?: string
  arch?: string
  basePath?: string
  installPath?: string
}

export abstract class BaseBrowserConfig {
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

  async getDownloadUrl({ platform, version, arch }: BrowserParams): Promise<string> {
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

  protected normalizePlatform(platform: string): SupportedPlatform {
    const normalized = platform.toLowerCase()
    return (
      ({ macos: 'mac', darwin: 'mac', win: 'windows' } as const)[normalized] ??
      (normalized as SupportedPlatform)
    )
  }

  protected validatePlatformConfig(
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

  protected replaceTemplate(template: string, vars: TemplateVariables): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in vars)) throw new Error(`Missing template variable: ${key}`)
      return vars[key]
    })
  }
} 