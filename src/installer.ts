import { BlobReader, ZipReader } from '@zip-js/zip-js'
import { dirname, normalize } from '@std/path'
import ProgressBar from '@deno-library/progress'
import { writeAll } from '@std/io/write-all'
import { logger } from './logger.ts'
import type { PlatformConfig, InstallArgs } from './browser-base-config.ts'

/**
 * Browser installation utilities for managing browser installations across platforms.
 * Supports Windows, macOS, and Linux with various installation methods:
 * - ZIP archives
 * - TAR archives
 * - Native installers (EXE, PKG, DMG, DEB)
 * 
 * @module installer
 */

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
 * Downloads a file with progress tracking
 * @param url - URL to download from
 * @param targetPath - Path to save the file to
 * @throws {Error} If download fails
 */
export async function downloadWithProgress(url: string, targetPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download: HTTP ${response.status}`)
  
  const contentLength = Number(response.headers.get('content-length'))
  const progress = new ProgressBar({
    title: 'Downloading...',
    total: contentLength,
    display: ':completed/:total :percent [:bar] :bytesPerSecond',
    complete: '=',
    incomplete: '-',
  })

  try {
    const file = await Deno.open(targetPath, { write: true, create: true })
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Failed to read response body')

    let downloaded = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await writeAll(file, value)
      downloaded += value.length
      await progress.render(downloaded)
    }
    file.close()
  } finally {
    progress.end()
  }
}

/**
 * Extracts a zip file with progress tracking
 */
export async function extractZip(filePath: string, targetDir: string): Promise<void> {
  const file = await Deno.readFile(filePath)
  const zipReader = new ZipReader(new BlobReader(new Blob([file])))
  const entries = await zipReader.getEntries()

  const progress = new ProgressBar({
    title: 'Extracting...',
    total: entries.length,
    display: ':completed/:total :percent [:bar]',
    complete: '=',
    incomplete: '-',
  })

  try {
    await Promise.all(entries.map(async (entry, index) => {
      const path = normalize(`${targetDir}/${entry.filename}`)
      if (!path.startsWith(targetDir)) {
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
      await progress.render(index + 1)
    }))
  } finally {
    progress.end()
    await zipReader.close()
  }
}

/**
 * Executes a command with error handling
 */
export async function execCommand(command: Deno.Command, errorMessage: string): Promise<void> {
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
 * Runs platform-specific installers
 * @param downloadedFile - Path to the downloaded installer file (temporary location)
 * @param targetPath - Final installation path where the browser will be installed
 * @param platform - Target platform (windows, mac, linux)
 * @param config - Platform-specific configuration including installation arguments
 */
export async function runInstaller(
  downloadedFile: string,
  targetPath: string,
  platform: string,
  config: PlatformConfig,
): Promise<void> {
  const replaceVars = (str: string, vars: Record<string, string>): string =>
    Object.entries(vars).reduce((s, [k, v]) => s.replace(`{{${k}}}`, v), str)

  const getArgs = (type: string, vars: Record<string, string>): string[] | undefined => {
    const [section, key] = type.split('.')
    if (section === 'dmg' && key) {
      const dmgArgs = config.installArgs?.dmg?.[key as keyof InstallArgs['dmg']] as string[] | undefined
      return dmgArgs && Array.isArray(dmgArgs) 
        ? dmgArgs.map(arg => replaceVars(arg, vars))
        : undefined
    }
    const args = config.installArgs?.[type as keyof Omit<InstallArgs, 'dmg'>] as string[] | undefined
    return args && Array.isArray(args)
      ? args.map(arg => replaceVars(arg, vars))
      : undefined
  }

  // Variables available for installer arguments:
  // - installPath: Final installation directory
  // - downloadedInstallerPath: Path to the downloaded installer file
  // - mountPoint: (DMG only) Where the disk image is mounted
  // - appPath: (DMG only) Path to the .app inside mounted disk image
  // - basePath: Base installation directory for the platform
  const vars = { 
    installPath: targetPath,
    downloadedInstallerPath: downloadedFile,
    basePath: dirname(targetPath)
  }
  
  if (platform === 'windows' && downloadedFile.endsWith('.exe')) {
    await execCommand(
      new Deno.Command(downloadedFile, {
        args: getArgs('exe', vars) ?? ['/silent', `/installdir=${targetPath}`]
      }),
      'Installation failed'
    )
  } else if (platform === 'mac') {
    if (downloadedFile.endsWith('.pkg')) {
      await execCommand(
        new Deno.Command('installer', {
          args: getArgs('pkg', vars) ?? ['-pkg', downloadedFile, '-target', '/']
        }),
        'Installation failed'
      )
    } else if (downloadedFile.endsWith('.dmg')) {
      await handleDmgInstall(downloadedFile, targetPath, getArgs)
    }
  } else if (platform === 'linux' && downloadedFile.endsWith('.deb')) {
    await execCommand(
      new Deno.Command('sudo', {
        args: getArgs('deb', vars) ?? ['dpkg', '-i', downloadedFile]
      }),
      'Installation failed'
    )
  } else {
    throw new Error(`Unsupported installer format for ${platform}: ${downloadedFile}`)
  }
} 