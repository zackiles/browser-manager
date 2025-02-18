import { getCurrentArch, getCurrentPlatform } from '../src/utils.ts'

export const testBrowsers = {
  chromium: {version: '120.0.6099.109', arch: getCurrentArch(), platform: getCurrentPlatform()},
  // Need to use https://github.com/berstend/chrome-versions to determine oldest version still published
  chrome: {version: '120.0.6099.109', arch: getCurrentArch(), platform: getCurrentPlatform()},
  // Edge doesn't publish a long history, oldest version as of 2025-02-18 is 114.0.1823.82
  edge: {version: '114.0.1823.82', arch: getCurrentArch(), platform: getCurrentPlatform()},
  brave: {version: '1.47.171', arch: getCurrentArch(), platform: getCurrentPlatform()},
  arc: {arch: getCurrentArch(), platform: getCurrentPlatform()},
}


