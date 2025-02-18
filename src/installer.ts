import { BlobReader, ZipReader } from '@zip-js/zip-js'
import { dirname, normalize } from '@std/path'
import { ensureDir } from '@std/fs'
import ProgressBar from '@deno-library/progress'
import { writeAll } from '@std/io/write-all'
import { logger } from './logger.ts'
import type { BaseBrowserConfig } from './browser-base-config.ts'
import { getCurrentArch, getCurrentPlatform } from './utils.ts'

/**
 * Browser installation utilities for managing browser installations across platforms.
 * Supports Windows, macOS, and Linux with various installation methods:
 * - ZIP archives
 * - TAR archives
 * - Native installers (EXE, PKG, DMG, DEB)
 * 
 * @module installer
 */

/**
 * Extracts a zip file to the specified directory with progress tracking
 * @param filePath - Path to the zip file to extract
 * @param targetDir - Directory where the contents will be extracted
 * @throws {Error} If file reading, extraction, or permission operations fail
 */
async function extractZip(filePath: string, targetDir: string): Promise<void> {
  const file = await Deno.readFile(filePath)
  const reader = new BlobReader(new Blob([file]))
  const zipReader = new ZipReader(reader)
  const entries = await zipReader.getEntries()

  const progressBar = new ProgressBar({
    title: 'Extracting...',
    total: entries.length,
    display: ':completed/:total :percent [:bar]',
    complete: '=',
    incomplete: '-',
  })

  try {
    for (const [index, entry] of entries.entries()) {
      const path = normalize(`${targetDir}/${entry.filename}`)

      if (entry.directory) {
        await Deno.mkdir(path, { recursive: true })
        continue
      }

      await Deno.mkdir(dirname(path), { recursive: true })

      if (entry.getData) {
        const chunks: Uint8Array[] = []
        const writable = new WritableStream({
          write(chunk) {
            chunks.push(chunk)
            return Promise.resolve()
          },
        })
        await entry.getData(writable)

        const combined = new Uint8Array(
          chunks.reduce((acc, chunk) => acc + chunk.length, 0),
        )
        let offset = 0
        for (const chunk of chunks) {
          combined.set(chunk, offset)
          offset += chunk.length
        }
        await Deno.writeFile(path, combined)

        // Make executables executable on Unix-like systems
        if (path.endsWith('.exe') || path.endsWith('chrome') || path.endsWith('brave') || 
            path.endsWith('msedge') || path.endsWith('chromium')) {
          await Deno.chmod(path, 0o755)
        }
      }

      await progressBar.render(index + 1)
    }
  } catch (error) {
    logger.error(`Failed to extract zip file: ${error}`)
    throw error
  } finally {
    progressBar.end()
    await zipReader.close()
  }
}

/**
 * Extracts a tar file to the specified directory using the system's tar command
 * @param filePath - Path to the tar file to extract
 * @param targetDir - Directory where the contents will be extracted
 * @throws {Error} If the tar command fails or returns a non-zero exit code
 */
async function extractTar(filePath: string, targetDir: string): Promise<void> {
  const command = new Deno.Command('tar', {
    args: ['xf', filePath, '-C', targetDir],
    stdout: 'piped',
    stderr: 'piped',
  })

  const { code, stderr } = await command.output()
  if (code !== 0) {
    const error = new TextDecoder().decode(stderr)
    logger.error(`Tar extraction failed: ${error}`)
    throw new Error(`Failed to extract tar file: ${error}`)
  }
}

/**
 * Runs a platform-specific installer with appropriate silent installation flags
 * @param installerPath - Path to the installer file
 * @param installPath - Target installation directory
 * @param platform - Target platform (windows, mac, linux)
 * @throws {Error} If the installer fails or returns a non-zero exit code
 */
async function runInstaller(
  installerPath: string,
  installPath: string,
  platform: string,
): Promise<void> {
  let command: Deno.Command | undefined
  let mountPoint: string | undefined
  
  try {
    switch (platform) {
      case 'windows':
        command = new Deno.Command(installerPath, {
          args: ['/silent', `/installdir=${installPath}`],
        })
        break
      case 'mac':
        // For .pkg files
        if (installerPath.endsWith('.pkg')) {
          command = new Deno.Command('installer', {
            args: ['-pkg', installerPath, '-target', '/'],
          })
        } 
        // For .dmg files
        else if (installerPath.endsWith('.dmg')) {
          // Mount the DMG
          mountPoint = await Deno.makeTempDir()
          const mountCmd = new Deno.Command('hdiutil', {
            args: ['attach', installerPath, '-mountpoint', mountPoint, '-nobrowse', '-quiet'],
          })
          await mountCmd.output()

          // Find the .app directory
          const entries = Deno.readDirSync(mountPoint)
          let appPath = ''
          for (const entry of entries) {
            if (entry.name.endsWith('.app')) {
              appPath = `${mountPoint}/${entry.name}`
              break
            }
          }

          if (!appPath) {
            throw new Error('No .app found in DMG')
          }

          // Copy the .app to the installation directory
          command = new Deno.Command('cp', {
            args: ['-R', appPath, installPath],
          })

          // Clean up DMG after installation
          await command.output()
          const unmountCmd = new Deno.Command('hdiutil', {
            args: ['detach', mountPoint, '-quiet'],
          })
          await unmountCmd.output()
          return
        }
        break
      case 'linux':
        if (installerPath.endsWith('.deb')) {
          command = new Deno.Command('sudo', {
            args: ['dpkg', '-i', installerPath],
          })
        } else {
          throw new Error(`Unsupported installer format for Linux: ${installerPath}`)
        }
        break
      default:
        throw new Error(`Unsupported platform for installer: ${platform}`)
    }

    if (!command) {
      throw new Error(`No installer command configured for ${platform}`)
    }

    const { code, stderr } = await command.output()
    if (code !== 0) {
      const error = new TextDecoder().decode(stderr)
      logger.error(`Installation failed: ${error}`)
      throw new Error(`Installer failed: ${error}`)
    }
  } finally {
    if (mountPoint) {
      try {
        await Deno.remove(mountPoint, { recursive: true })
      } catch (error) {
        logger.warn(`Failed to clean up mount point ${mountPoint}: ${error}`)
      }
    }
  }
}

/**
 * Cleans up temporary files and directories created during installation
 * @param paths - Array of paths to clean up
 */
async function cleanup(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      await Deno.remove(path, { recursive: true })
    } catch (error) {
      logger.warn(`Failed to clean up ${path}: ${error}`)
    }
  }
}

/**
 * Installs a browser using the provided configuration
 * @param browserConfig - Browser configuration containing download and installation details
 * @throws {Error} If download, extraction, or installation fails
 */
export async function install(browserConfig: BaseBrowserConfig): Promise<void> {
  const platform = getCurrentPlatform()
  const arch = getCurrentArch()
  const tempDir = await Deno.makeTempDir()
  const pathsToCleanup: string[] = [tempDir]

  try {
    // Get download URL and installation path
    const downloadUrl = await browserConfig.getDownloadUrl({ platform, arch })
    const basePath = platform === 'mac' ? '/Applications' : 
                    platform === 'windows' ? 'C:\\Program Files' : 
                    '/usr/local'
    const installPath = browserConfig.getInstallPath({ platform, basePath })

    // Download the browser
    logger.info(`Downloading ${browserConfig.name} from ${downloadUrl}...`)
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download: HTTP ${response.status}`)
    }

    const contentLength = Number(response.headers.get('content-length'))
    const tempFile = await Deno.makeTempFile({ dir: tempDir })
    pathsToCleanup.push(tempFile)

    const progressBar = new ProgressBar({
      title: 'Downloading...',
      total: contentLength,
      display: ':completed/:total :percent [:bar] :bytesPerSecond',
      complete: '=',
      incomplete: '-',
    })

    try {
      const file = await Deno.open(tempFile, { write: true, create: true })
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Failed to read response body')

      let downloaded = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        await writeAll(file, value)
        downloaded += value.length
        await progressBar.render(downloaded)
      }
      progressBar.end()
      file.close()
    } catch (error) {
      progressBar.end()
      throw error
    }

    // Create installation directory
    await ensureDir(dirname(installPath))

    // Handle different file types
    if (downloadUrl.endsWith('.zip')) {
      await extractZip(tempFile, installPath)
    } else if (downloadUrl.endsWith('.tar.gz') || downloadUrl.endsWith('.tgz')) {
      await extractTar(tempFile, installPath)
    } else if (downloadUrl.endsWith('.exe') || downloadUrl.endsWith('.pkg') || 
               downloadUrl.endsWith('.dmg') || downloadUrl.endsWith('.deb')) {
      await runInstaller(tempFile, installPath, platform)
    } else {
      throw new Error(`Unsupported file format: ${downloadUrl}`)
    }

    logger.info(`Successfully installed ${browserConfig.name} to ${installPath}`)
  } catch (error) {
    logger.error(`Failed to install ${browserConfig.name}: ${error}`)
    throw error
  } finally {
    await cleanup(pathsToCleanup)
  }
}

/**
 * Removes a browser installation from the system
 * @param browserConfig - Browser configuration containing installation details
 * @throws {Error} If removal fails
 */
export async function remove(browserConfig: BaseBrowserConfig): Promise<void> {
  const platform = getCurrentPlatform()
  const basePath = platform === 'mac' ? '/Applications' : 
                  platform === 'windows' ? 'C:\\Program Files' : 
                  '/usr/local'
  const installPath = browserConfig.getInstallPath({ platform, basePath })

  try {
    await Deno.remove(installPath, { recursive: true })
    logger.info(`Successfully removed ${browserConfig.name} from ${installPath}`)
  } catch (error) {
    logger.error(`Failed to remove ${browserConfig.name}: ${error}`)
    throw error
  }
} 