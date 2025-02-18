/**
 * Maps Deno.build.os to supported platform strings used in browser configurations
 * @returns 'windows' | 'mac' | 'linux'
 */
export function getCurrentPlatform(): string {
  const platform = Deno.build.os
  switch (platform) {
    case 'darwin':
      return 'mac'
    case 'windows':
      return 'windows'
    case 'linux':
      return 'linux'
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

/**
 * Maps Deno.build.arch to supported architecture strings used in browser configurations
 * @returns 'x64' | 'arm64'
 */
export function getCurrentArch(): string {
  const arch = Deno.build.arch
  switch (arch) {
    case 'x86_64':
      return 'x64'
    case 'aarch64':
      return 'arm64'
    default:
      throw new Error(`Unsupported architecture: ${arch}`)
  }
}
