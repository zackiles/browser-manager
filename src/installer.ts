import { BlobReader, ZipReader } from '@zip-js/zip-js'
import { dirname, normalize } from '@std/path'
import { writeAll } from '@std/io/write-all'
import { logger } from './logger.ts'
import type { InstallArgs } from './browser-base-config.ts'

/**
 * Browser installation utilities for managing browser installations across platforms.
 * Supports Windows, macOS, and Linux with various installation methods:
 * - ZIP archives
 * - TAR archives
 * - Native installers (EXE, PKG, DMG, DEB)
 * 
 * @module installer
 */

/** Default installation paths for each supported platform */
export const PLATFORM_PATHS = {
  mac: '/Applications',
  windows: 'C:\\Program Files',
  linux: '/usr/local',
} as const

/**
 * List of executable identifiers to set execute permissions on after extraction
 * Includes both Windows executable extensions (.exe) and Unix-like binary names
 * Used to ensure extracted browser binaries have the correct permissions
 */
const EXECUTABLES = ['.exe', 'chrome', 'brave', 'msedge', 'chromium'] as const

/**
 * Downloads a file from a URL with progress tracking.
 * @param url - The URL to download from
 * @param destinationPath - The path where the file should be saved
 * @param browser - Name of the browser being downloaded (for progress display)
 * @returns Promise that resolves when download is complete
 */
export async function downloadWithProgress(
  url: string,
  destinationPath: string,
  browser: string
): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download: HTTP ${response.status}`)
  
  const contentLength = Number(response.headers.get('content-length'))
  const progress = logger.createProgressBar({
    title: 'Downloading...',
    total: contentLength,
  })

  try {
    const file = await Deno.open(destinationPath, { write: true, create: true })
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Failed to read response body')

    let downloaded = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await writeAll(file, value)
      downloaded += value.length
      logger.updateProgress(progress, downloaded)
    }
    file.close()
  } finally {
    logger.endProgress(progress)
  }
}

/**
 * Extracts a ZIP archive to a specified destination.
 * @param zipPath - Path to the ZIP file
 * @param destinationPath - Directory to extract to
 * @returns Promise that resolves when extraction is complete
 */
export async function extractZip(
  zipPath: string,
  destinationPath: string
): Promise<void> {
  const file = await Deno.readFile(zipPath)
  const zipReader = new ZipReader(new BlobReader(new Blob([file])))
  const entries = await zipReader.getEntries()

  const progress = logger.createProgressBar({
    title: 'Extracting...',
    total: entries.length,
  })

  try {
    await Promise.all(entries.map(async (entry, index) => {
      const path = normalize(`${destinationPath}/${entry.filename}`)
      if (!path.startsWith(destinationPath)) {
        throw new Error(`Invalid path in ZIP: ${entry.filename}`)
      }

      if (entry.directory) {
        await Deno.mkdir(path, { recursive: true })
        return
      }

      await Deno.mkdir(dirname(path), { recursive: true })

      if (entry.getData) {
        const chunks: Uint8Array[] = []
        await entry.getData(new WritableStream({
          write: chunk => { chunks.push(chunk); return Promise.resolve() }
        }))

        const data = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        for (const chunk of chunks) {
          data.set(chunk, offset)
          offset += chunk.length
        }
        await Deno.writeFile(path, data)

        if (EXECUTABLES.some(ext => path.endsWith(ext))) {
          await Deno.chmod(path, 0o755)
        }
      }
      logger.updateProgress(progress, index + 1)
    }))
  } finally {
    logger.endProgress(progress)
    await zipReader.close()
  }
}

/**
 * Executes a command with error handling and logging.
 * @param command - The Deno.Command to execute
 * @param errorMessage - Error message prefix to use if the command fails
 * @throws Error if the command exits with a non-zero status
 */
export async function execCommand(
  command: Deno.Command,
  errorMessage: string
): Promise<void> {
  const { code, stderr } = await command.output()
  if (code !== 0) {
    const error = new TextDecoder().decode(stderr)
    logger.error(`${errorMessage}: ${error}`)
    throw new Error(`${errorMessage}: ${error}`)
  }
}

/**
 * Handles DMG installation on macOS
 * @param downloadedFile - Path to the downloaded DMG file
 * @param targetPath - Final installation path for the browser
 * @param getArgs - Function to get installer arguments
 */
export async function handleDmgInstall(
  downloadedFile: string,
  targetPath: string,
  getArgs: (type: string, vars: Record<string, string>) => string[] | undefined,
): Promise<void> {
  const mountPoint = await Deno.makeTempDir()
  
  try {
    const vars = { 
      downloadedInstallerPath: downloadedFile,
      installPath: targetPath,
      mountPoint,
      basePath: dirname(targetPath)
    }
    
    // Mount DMG
    await execCommand(
      new Deno.Command('hdiutil', {
        args: getArgs('dmg.mount', vars) ?? 
              ['attach', downloadedFile, '-mountpoint', mountPoint, '-nobrowse', '-quiet']
      }),
      'Failed to mount DMG'
    )

    // Find and copy .app
    const appName = Array.from(Deno.readDirSync(mountPoint))
      .find(entry => entry.name.endsWith('.app'))
      ?.name
    
    if (!appName) throw new Error('No .app found in DMG')
    
    const appPath = `${mountPoint}/${appName}`
    await execCommand(
      new Deno.Command('cp', {
        args: getArgs('dmg.copy', { ...vars, appPath }) ?? 
              ['-R', appPath, dirname(targetPath)]
      }),
      'Failed to copy app'
    )
  } finally {
    try {
      await execCommand(
        new Deno.Command('hdiutil', {
          args: getArgs('dmg.unmount', { mountPoint }) ?? 
                ['detach', mountPoint, '-quiet']
        }),
        'Failed to unmount DMG'
      )
    } catch (error) {
      logger.warn(`Failed to unmount DMG: ${error}`)
    }
    await Deno.remove(mountPoint, { recursive: true })
  }
}

/**
 * Runs a platform-specific installer with the provided arguments.
 * Handles different installer types (EXE, PKG, DMG, DEB) appropriately.
 * @param installerPath - Path to the installer file
 * @param args - Installation arguments from the browser config
 * @param platform - Target platform
 * @returns Promise that resolves when installation is complete
 */
export async function runInstaller(
  installerPath: string,
  args: InstallArgs,
  platform: string
): Promise<void> {
  const replaceVars = (str: string, vars: Record<string, string>): string =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? key)

  const getArgs = (type: string, vars: Record<string, string>): string[] | undefined => {
    const [section, key] = type.split('.')
    if (section === 'dmg' && key && args.dmg) {
      const dmgArgs = args.dmg[key as keyof InstallArgs['dmg']] as string[] | undefined
      return dmgArgs && Array.isArray(dmgArgs) 
        ? dmgArgs.map(arg => replaceVars(arg, vars))
        : undefined
    }
    const installerArgs = args[type as keyof Omit<InstallArgs, 'dmg'>] as string[] | undefined
    return installerArgs && Array.isArray(installerArgs)
      ? installerArgs.map(arg => replaceVars(arg, vars))
      : undefined
  }

  // Variables available for template substitution:
  // - installPath: Final installation directory
  // - downloadedInstallerPath: Path to the downloaded installer file
  // - basePath: Base installation directory for the platform
  const vars = { 
    installPath: installerPath,
    downloadedInstallerPath: installerPath,
    basePath: dirname(installerPath)
  }
  
  if (platform === 'windows' && installerPath.endsWith('.exe')) {
    await execCommand(
      new Deno.Command(installerPath, {
        args: getArgs('exe', vars) ?? ['/silent', `/installdir=${installerPath}`]
      }),
      'Installation failed'
    )
  } else if (platform === 'mac') {
    if (installerPath.endsWith('.pkg')) {
      await execCommand(
        new Deno.Command('installer', {
          args: getArgs('pkg', vars) ?? ['-pkg', installerPath, '-target', '/']
        }),
        'Installation failed'
      )
    } else if (installerPath.endsWith('.dmg')) {
      await handleDmgInstall(installerPath, installerPath, getArgs)
    }
  } else if (platform === 'linux' && installerPath.endsWith('.deb')) {
    await execCommand(
      new Deno.Command('sudo', {
        args: getArgs('deb', vars) ?? ['dpkg', '-i', installerPath]
      }),
      'Installation failed'
    )
  } else {
    throw new Error(`Unsupported installer format for ${platform}: ${installerPath}`)
  }
} 