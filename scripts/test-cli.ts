import '@std/dotenv'

import { chromium } from '../src/browser-provider.ts'
import { getCurrentArch, getCurrentPlatform } from '../src/utils.ts'
import { testBrowsers } from '../test/test-browsers.ts'
import type { SupportedPlatform, SupportedArch } from '../src/browser-base-config.ts'

const browserInstall = await chromium.install(testBrowsers.chromium)

const currentVersion = await chromium.getLatestVersion(getCurrentPlatform() as SupportedPlatform, getCurrentArch() as SupportedArch)
console.log(currentVersion)
/** 
// Loop through test browsers and get download URLs
for (const [browserName, browserConfig] of Object.entries(testBrowsers)) {
  const browser = BROWSERS[browserName as keyof typeof BROWSERS]
  console.log(browserConfig)  
  const downloadUrl = await browser.getDownloadUrl(browserConfig)
  console.log(`${browserName}: ${downloadUrl}`)
}
*/