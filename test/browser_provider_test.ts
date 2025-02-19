import { assertEquals, assertExists } from 'jsr:@std/assert@1'
import { chrome, chromium, edge, brave, arc } from './mock-browser-configs.ts'
import { testBrowsers } from './mock-configs.ts'
import { getCurrentArch, getCurrentPlatform } from '../src/utils.ts'
import type { BaseBrowserConfig } from '../src/browser-base-config.ts'

const BROWSERS: Record<string, BaseBrowserConfig> = {
  chrome,
  chromium,
  edge,
  brave,
  arc,
}

Deno.test('browser instances are properly initialized', () => {
  // Test that all browser instances exist
  assertExists(chrome, 'Chrome instance should exist')
  assertExists(chromium, 'Chromium instance should exist')
  assertExists(edge, 'Edge instance should exist')
  assertExists(brave, 'Brave instance should exist')
  assertExists(arc, 'Arc instance should exist')
})

Deno.test('BROWSERS map contains all browser instances', () => {
  assertEquals(Object.keys(BROWSERS).length, 5, 'Should have 5 browser configurations')
  assertEquals(Object.keys(BROWSERS).sort(), ['arc', 'brave', 'chrome', 'chromium', 'edge'].sort())
})

Deno.test('browser configs detect current platform and arch', () => {
  const expectedPlatform = getCurrentPlatform()
  const expectedArch = getCurrentArch()

  for (const [name, browser] of Object.entries(BROWSERS)) {
    assertEquals(
      browser.platforms[expectedPlatform].arch.includes(expectedArch),
      true,
      `${name} should support current architecture on current platform`
    )
  }
})

Deno.test('browser version resolution matches test config', async () => {
  // Test specific browser versions from our mock configs
  assertEquals(
    await chromium.getLatestVersion(),
    testBrowsers.chromium.version,
    'Chromium version should match test config'
  )
  assertEquals(
    await chrome.getLatestVersion(),
    testBrowsers.chrome.version,
    'Chrome version should match test config'
  )
  assertEquals(
    await edge.getLatestVersion(),
    testBrowsers.edge.version,
    'Edge version should match test config'
  )
  assertEquals(
    await brave.getLatestVersion(),
    testBrowsers.brave.version,
    'Brave version should match test config'
  )
  
  // Arc is special as it doesn't have a version in test config
  const arcVersion = await arc.getLatestVersion()
  assertExists(arcVersion, 'Arc should have a version')
}) 