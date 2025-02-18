/**
 * Usage Example:
 * 
  const browser = BROWSERS['chromium']
  const downloadUrl = await browser.getDownloadUrl('mac', '120.0.6099.109', 'arm64')
  const installPath = browser.getInstallPath('mac', '/Applications')
  const executable = browser.getExecutable('mac', installPath)
  console.log({ downloadUrl, installPath, executable })
 */
import { BROWSERS } from './browser-provider.ts'
import { testBrowsers, testInstallBaseDirectory } from '../test/test-browsers.ts'

// Loop through test browsers and get download URLs
for (const [browserName, browserConfig] of Object.entries(testBrowsers)) {
  const browser = BROWSERS[browserName as keyof typeof BROWSERS]
  console.log(browserConfig)  
  const downloadUrl = await browser.getDownloadUrl(browserConfig)
  console.log(`${browserName}: ${downloadUrl}`)
}
