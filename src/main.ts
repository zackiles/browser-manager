/**
 * Usage Example:
 * 
  const browser = BROWSERS['chromium']
  const downloadUrl = await browser.getDownloadUrl('mac', '120.0.6099.109', 'arm64')
  const installPath = browser.getInstallPath('mac', '/Applications')
  const executable = browser.getExecutable('mac', installPath)
  console.log({ downloadUrl, installPath, executable })
 */
import { BROWSERS } from './browser-config.ts'

const browser = BROWSERS.chromium
const downloadUrl = await browser.getDownloadUrl({
  platform: 'Mac',
  version: '120.0.6099.109',
  arch: 'arm64',
})
console.log(downloadUrl)
