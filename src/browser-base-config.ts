/**
 * Base browser configuration module.
 * Provides core types and base class for browser configurations.
 * Defines the contract for browser-specific implementations.
 * 
 * @module browser-base-config
 */

import { dirname } from '@std/path'
import { ensureDir } from '@std/fs'
import { logger } from './logger.ts'
import { downloadWithProgress, extractZip, execCommand, runInstaller } from './installer.ts'

/** Object containing key-value pairs for template variable substitution */
export type TemplateVariables = Record<string, string>

/** Supported operating system platforms */
export type SupportedPlatform = 'windows' | 'mac' | 'linux'

/** Supported CPU architectures */
export type SupportedArch = 'x64' | 'arm64'

/**
 * Installation arguments configuration for different installer types.
 * Provides platform-specific installation command arguments.
 */
export interface InstallArgs {
  /** Arguments for Windows .exe installers */
  exe?: string[]
  /** Arguments for macOS .pkg installers */
  pkg?: string[]
  /** Arguments for macOS .dmg handling */
  dmg?: {
    /** Arguments for mounting the DMG */
    mount?: string[]
    /** Arguments for copying the .app */
    copy?: string[]
    /** Arguments for unmounting the DMG */
    unmount?: string[]
  }
  /** Arguments for Linux .deb installers */
  deb?: string[]
}

/**
 * Platform-specific configuration for a browser.
 * Contains all necessary information to download, install and run a browser on a specific platform.
 */
export interface PlatformConfig {
  /** Supported architectures for this platform */
  readonly arch: SupportedArch[]
  /** 
   * Template for the download URL
   * Supports variables: {{version}}, {{arch}}
   */
  readonly downloadUrlTemplate?: string
  /** 
   * Function to resolve download URL dynamically
   * Used when the URL can't be determined by a simple template
   */
  readonly downloadUrlResolver?: (
    version: string,
    arch: SupportedArch,
  ) => Promise<string>
  /** 
   * Template for the installation path
   * Supports variables: {{basePath}}, {{version}}
   */
  readonly installPathTemplate: string
  /** 
   * Template for the executable path
   * Supports variables: {{installPath}}
   */
  readonly executableTemplate: string
  /** 
   * Installation arguments for different installer types
   * All arguments support variable substitution using {{variableName}} syntax
   */
  readonly installArgs?: InstallArgs
}

/**
 * Parameters for browser installation and configuration.
 * Used to specify the target platform, version, and installation paths.
 */
export interface BrowserParams {
  /** Target platform for the browser */
  platform: string
  /** Specific version to install (optional) */
  version?: string
  /** Target architecture (optional) */
  arch?: string
  /** Base installation path (optional) */
  basePath?: string
  /** Full installation path (optional) */
  installPath?: string
  /** Custom base path override (optional) */
  customBasePath?: string
}

/**
 * Information about a browser installation.
 * Contains metadata about the installed browser instance.
 */
export interface InstallationInfo {
  /** Name of the browser */
  browser: string
  /** Version of the browser */
  version?: string
  /** Platform the browser was installed on */
  platform: string
  /** Architecture the browser was built for */
  arch?: string
  /** URL the browser was downloaded from */
  downloadUrl: string
  /** Whether this was installed to a custom path */
  isCustomPath: boolean
  /** Base path where the browser was installed */
  basePath: string
  /** When the browser was installed */
  installDate: string
}

/**
 * Base class for browser configurations
 * Provides common functionality for managing browser installations
 */
export abstract class BaseBrowserConfig {
  /** Cache for version responses to reduce API calls */
  protected versionCache: Map<string, { version: string; timestamp: number }> = new Map<string, { version: string; timestamp: number }>()
  /** Time-to-live for cached version data in milliseconds */
  protected readonly CACHE_TTL = 1000 * 60 * 60 // 1 hour

  /**
   * Creates a new browser configuration.
   * @param name - Name of the browser
   * @param platforms - Platform-specific configuration map
   */
  constructor(
    public readonly name: string,
    public readonly platforms: Record<string, PlatformConfig>,
  ) {}

  /**
   * Checks if a platform is supported by this browser.
   * @param platform - Platform to check
   * @returns True if the platform is supported
   */
  isValidPlatform(platform: string): boolean {
    return this.normalizePlatform(platform) in this.platforms
  }

  /**
   * Checks if an architecture is supported for a given platform.
   * @param platform - Target platform
   * @param arch - Architecture to check
   * @returns True if the architecture is supported
   */
  isValidArch(platform: string, arch: string): boolean {
    const normalizedPlatform = this.normalizePlatform(platform)
    const config = this.platforms[normalizedPlatform]
    return config?.arch.includes(arch?.toLowerCase() as SupportedArch) ?? false
  }

  /**
   * Gets the download URL for the browser.
   * @param params - Browser parameters including platform, version, and architecture
   * @returns Promise resolving to the download URL
   * @throws Error if the platform configuration is invalid or URL cannot be determined
   */
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

  /**
   * Gets the installation path for the browser.
   * @param params - Browser parameters including platform, base path, and version
   * @returns Installation path string
   */
  getInstallPath({ platform, basePath, version = '' }: BrowserParams): string {
    const config = this.validatePlatformConfig(this.normalizePlatform(platform))
    return this.replaceTemplate(config.installPathTemplate, {
      basePath: basePath ?? '',
      version,
    })
  }

  /**
   * Gets the executable path for the browser.
   * @param params - Browser parameters including platform and installation path
   * @returns Executable path string
   */
  getExecutable({ platform, installPath }: BrowserParams): string {
    const config = this.validatePlatformConfig(this.normalizePlatform(platform))
    return this.replaceTemplate(config.executableTemplate, {
      installPath: installPath ?? '',
    })
  }

  /**
   * Normalizes platform strings to supported platform types.
   * @param platform - Platform string to normalize
   * @returns Normalized platform string
   * @protected
   */
  protected normalizePlatform(platform: string): SupportedPlatform {
    const normalized = platform.toLowerCase()
    return (
      ({ macos: 'mac', darwin: 'mac', win: 'windows' } as const)[normalized] ??
      (normalized as SupportedPlatform)
    )
  }

  /**
   * Validates platform configuration and architecture.
   * @param platform - Platform to validate
   * @param arch - Optional architecture to validate
   * @returns Validated platform configuration
   * @throws Error if platform or architecture is not supported
   * @protected
   */
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

  /**
   * Replaces template variables in a string with their values
   * @param template - String containing {{variableName}} placeholders
   * @param vars - Object containing variable values
   * @returns String with all variables replaced
   * @throws {Error} If a required variable is missing
   */
  protected replaceTemplate(template: string, vars: TemplateVariables): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in vars)) throw new Error(`Missing template variable: ${key}`)
      return vars[key]
    })
  }

  /**
   * Installs the browser using the provided configuration
   * @param params - Installation parameters including platform, version, arch, and optional customBasePath
   * @throws {Error} If installation fails. If using customBasePath, will attempt to clean up created directories on failure.
   */
  async install(params: BrowserParams): Promise<void> {
    const { platform, arch, customBasePath } = params
    const tempDir = await Deno.makeTempDir()
    let basePath: string = ''
    
    try {
      logger.debug(`Resolving download URL for ${this.name} (platform: ${platform}, arch: ${arch})`)
      const downloadUrl = await this.getDownloadUrl(params)
      
      const isCustomPath = !!customBasePath
      if (customBasePath) {
        logger.debug(`Using custom installation path: ${customBasePath}`)
        // Create custom base directory if it doesn't exist
        await ensureDir(customBasePath)
        // Convert relative paths to absolute
        basePath = customBasePath.startsWith('.') 
          ? await Deno.realPath(customBasePath)
          : customBasePath
        logger.debug(`Resolved absolute base path: ${basePath}`)
      } else {
        const PLATFORM_PATHS = {
          mac: '/Applications',
          windows: 'C:\\Program Files',
          linux: '/usr/local',
        } as const
        basePath = PLATFORM_PATHS[platform as keyof typeof PLATFORM_PATHS] ?? '/usr/local'
        logger.debug(`Using default installation path: ${basePath}`)
      }

      const targetPath = this.getInstallPath({ ...params, basePath })
      logger.debug(`Full installation target path: ${targetPath}`)
      
      const normalizedPlatform = platform === 'mac' ? 'mac' : platform === 'windows' ? 'windows' : 'linux'
      const platformConfig = this.platforms[normalizedPlatform as SupportedPlatform]

      logger.info(`Downloading ${this.name} from ${downloadUrl}...`)
      const downloadedFile = await Deno.makeTempFile({ dir: tempDir })
      logger.debug(`Created temporary file for download: ${downloadedFile}`)
      await downloadWithProgress(downloadUrl, downloadedFile, this.name)
      
      logger.debug(`Ensuring target directory exists: ${dirname(targetPath)}`)
      await ensureDir(dirname(targetPath))

      const fileType = downloadUrl.split('.').pop()?.toLowerCase()
      logger.debug(`Detected file type: ${fileType}`)
      
      switch(fileType) {
        case 'zip':
          logger.debug(`Extracting ZIP archive to ${targetPath}`)
          await extractZip(downloadedFile, targetPath)
          break
        case 'gz':
        case 'tgz':
          logger.debug(`Extracting tar archive to ${targetPath}`)
          await execCommand(
            new Deno.Command('tar', {
              args: ['xf', downloadedFile, '-C', targetPath],
              stdout: 'piped',
              stderr: 'piped',
            }),
            'Failed to extract tar file'
          )
          break
        case 'exe':
        case 'pkg':
        case 'dmg':
        case 'deb':
          logger.debug(`Running platform installer for ${fileType} file`)
          await runInstaller(downloadedFile, platformConfig.installArgs ?? {}, platform)
          break
        default:
          throw new Error(`Unsupported file format: ${downloadUrl}`)
      }

      // Store whether this was a custom path installation after the browser is installed
      logger.debug(`Ensuring installation info directory exists: ${dirname(targetPath)}`)
      await ensureDir(dirname(targetPath))
      
      let installations: InstallationInfo[] = []
      
      try {
        const infoPath = `${targetPath}/.installation-info`
        logger.debug(`Reading existing installation info from: ${infoPath}`)
        const existingInfo = await Deno.readTextFile(infoPath)
        installations = JSON.parse(existingInfo)
        if (!Array.isArray(installations)) {
          logger.debug('Converting legacy installation info format to array')
          // Convert old format to array
          const oldInfo = JSON.parse(existingInfo)
          installations = oldInfo.isCustomPath !== undefined ? [oldInfo] : []
        }
      } catch (_) {
        logger.debug('No existing installation info found, starting fresh')
      }

      // Add new installation info
      logger.debug('Adding new installation record')
      installations.push({
        browser: this.name,
        version: params.version,
        platform,
        arch,
        downloadUrl,
        isCustomPath,
        basePath,
        installDate: new Date().toISOString()
      })

      const infoPath = `${targetPath}/.installation-info`
      logger.debug(`Writing updated installation info to: ${infoPath}`)
      await Deno.writeTextFile(
        infoPath,
        JSON.stringify(installations, null, 2)
      )

      logger.info(`Successfully installed ${this.name} to ${targetPath}`)
    } catch (error) {
      // If installation fails and we created a custom directory, clean it up
      if (customBasePath) {
        logger.debug(`Installation failed, cleaning up custom directory: ${basePath}`)
        try {
          await Deno.remove(basePath, { recursive: true })
        } catch (_) {
          logger.debug(`Failed to clean up custom directory: ${basePath}`)
        }
      }
      throw error
    } finally {
      logger.debug(`Cleaning up temporary directory: ${tempDir}`)
      await Deno.remove(tempDir, { recursive: true })
    }
  }

  /**
   * Removes the browser installation
   * @param params - Removal parameters including platform and optional customBasePath
   * @throws {Error} If removal fails
   * @note If the installation used a custom base path, that directory will be removed only if empty after browser removal
   */
  async remove(params: BrowserParams): Promise<void> {
    const { platform } = params
    const PLATFORM_PATHS = {
      mac: '/Applications',
      windows: 'C:\\Program Files',
      linux: '/usr/local',
    } as const
    const defaultBasePath = PLATFORM_PATHS[platform as keyof typeof PLATFORM_PATHS] ?? '/usr/local'
    const targetPath = this.getInstallPath({ ...params, basePath: defaultBasePath })
    logger.debug(`Removing ${this.name} from: ${targetPath}`)
    
    try {
      // Read installation info to determine if this was a custom path installation
      let isCustomPath = false
      let customBasePath = ''
      let installations: InstallationInfo[] = []
      let infoPath = ''
      try {
        infoPath = `${targetPath}/.installation-info`
        logger.debug(`Reading installation info from: ${infoPath}`)
        const infoContent = await Deno.readTextFile(infoPath)
        const parsedInfo = JSON.parse(infoContent)
        // Handle both old and new formats
        if (Array.isArray(parsedInfo)) {
          logger.debug('Found array-format installation info')
          installations = parsedInfo
          // Find the most recent installation of this browser
          const installation = installations
            .filter(i => i.browser === this.name)
            .sort((a, b) => new Date(b.installDate).getTime() - new Date(a.installDate).getTime())[0]
          
          if (installation) {
            logger.debug(`Found most recent installation from: ${installation.installDate}`)
            isCustomPath = installation.isCustomPath
            customBasePath = installation.basePath
          }
        } else {
          logger.debug('Found legacy-format installation info')
          // Legacy format - convert to array format
          isCustomPath = parsedInfo.isCustomPath
          customBasePath = parsedInfo.basePath
          installations = [parsedInfo as InstallationInfo]
        }
      } catch (_) {
        logger.debug('No installation info found, assuming default installation')
      }

      // Remove the browser installation directory
      logger.debug(`Removing browser directory: ${targetPath}`)
      await Deno.remove(targetPath, { recursive: true })
      logger.info(`Successfully removed ${this.name} from ${targetPath}`)

      // Update installation info file if it exists
      if (installations.length > 0 && infoPath) {
        try {
          // Remove the matching installation entry
          const updatedInstallations = installations.filter(installation => {
            // Keep entries that don't match this browser and version
            return installation.browser !== this.name || 
                   (params.version && installation.version !== params.version)
          })

          if (updatedInstallations.length > 0) {
            // Write the updated installations back to the file
            logger.debug(`Updating installation info with ${updatedInstallations.length} remaining entries`)
            await Deno.writeTextFile(infoPath, JSON.stringify(updatedInstallations, null, 2))
          } else {
            // If no installations left, remove the file
            logger.debug('No installations remaining, removing .installation-info file')
            try {
              await Deno.remove(infoPath)
            } catch (_) {
              // Ignore error if file is already gone
            }
          }
        } catch (error) {
          logger.warn(`Failed to update installation info: ${error}`)
        }
      }

      // If this was a custom base path installation, try to clean up the base directory
      if (isCustomPath && customBasePath) {
        logger.debug(`Checking if custom base directory is empty: ${customBasePath}`)
        try {
          // Check if directory is empty
          const dirEntries = Array.from(Deno.readDirSync(customBasePath))
          if (dirEntries.length === 0) {
            logger.debug('Custom directory is empty, removing it')
            await Deno.remove(customBasePath)
            logger.info(`Removed empty custom installation directory: ${customBasePath}`)
          } else {
            logger.debug('Custom directory not empty, leaving intact')
            logger.info(`Custom installation directory not empty, leaving intact: ${customBasePath}`)
          }
        } catch (error) {
          logger.warn(`Failed to clean up custom installation directory: ${error}`)
        }
      }
    } catch (error) {
      logger.error(`Failed to remove ${this.name}: ${error}`)
      throw error
    }
  }

  /**
   * Gets the installation history for this browser
   * @param params - Parameters to locate the installation directory
   * @returns Array of installation records, sorted by date (most recent first)
   */
  async getInstallationHistory(params: BrowserParams): Promise<InstallationInfo[]> {
    const { platform } = params
    const PLATFORM_PATHS = {
      mac: '/Applications',
      windows: 'C:\\Program Files',
      linux: '/usr/local',
    } as const
    const defaultBasePath = PLATFORM_PATHS[platform as keyof typeof PLATFORM_PATHS] ?? '/usr/local'
    const targetPath = this.getInstallPath({ ...params, basePath: defaultBasePath })
    logger.debug(`Getting installation history for ${this.name} from: ${targetPath}`)
    
    try {
      const infoPath = `${targetPath}/.installation-info`
      logger.debug(`Reading installation info from: ${infoPath}`)
      const existingInfo = await Deno.readTextFile(infoPath)
      let installations: InstallationInfo[] = JSON.parse(existingInfo)
      
      // Handle legacy format
      if (!Array.isArray(installations)) {
        logger.debug('Converting legacy installation info to array format')
        const oldInfo = JSON.parse(existingInfo)
        installations = oldInfo.isCustomPath !== undefined ? [{
          browser: this.name,
          platform,
          isCustomPath: oldInfo.isCustomPath,
          basePath: oldInfo.basePath,
          downloadUrl: 'unknown', // Legacy format didn't store this
          installDate: new Date(0).toISOString() // Use epoch for legacy entries
        }] : []
      }

      // Filter to only this browser's installations and sort by date
      const filtered = installations
        .filter(i => i.browser === this.name)
        .sort((a, b) => new Date(b.installDate).getTime() - new Date(a.installDate).getTime())
      
      logger.debug(`Found ${filtered.length} installation records for ${this.name}`)
      return filtered
    } catch (_) {
      logger.debug(`No installation history found for ${this.name}`)
      return []
    }
  }

  /**
   * Gets the most recent installation info for this browser
   * @param params - Parameters to locate the installation directory
   * @returns Most recent installation record or null if none found
   */
  async getLatestInstallation(params: BrowserParams): Promise<InstallationInfo | null> {
    const history = await this.getInstallationHistory(params)
    return history[0] ?? null
  }

  /**
   * Gets the latest available version for the specified platform and architecture.
   * @param platform - Target platform (windows, mac, linux)
   * @param arch - Target architecture (x64, arm64)
   * @returns Promise resolving to the latest version string
   * @throws Error if version discovery fails
   */
  abstract getLatestVersion(
    platform: SupportedPlatform,
    arch: SupportedArch
  ): Promise<string>

  /**
   * Helper method to cache version responses
   * @param cacheKey - Unique key for caching the version
   * @param fetcher - Async function that fetches the version
   * @returns Promise resolving to the version string
   */
  protected async getCachedVersion(
    cacheKey: string,
    fetcher: () => Promise<string>
  ): Promise<string> {
    const now = Date.now()
    const cached = this.versionCache.get(cacheKey)
    
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      logger.debug(`Using cached version for ${this.name}: ${cached.version}`)
      return cached.version
    }

    try {
      const version = await fetcher()
      this.versionCache.set(cacheKey, { version, timestamp: now })
      logger.debug(`Cached new version for ${this.name}: ${version}`)
      return version
    } catch (error) {
      logger.error(`Failed to fetch version for ${this.name}: ${error}`)
      throw error
    }
  }
} 