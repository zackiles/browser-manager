/**
 * Browser provider module.
 * Exports browser configurations and types for all supported browsers.
 * Acts as the main entry point for accessing browser configurations.
 * 
 * @module browser-provider
 */
import { ChromeConfig } from './browser-configs/chrome-config.ts'
import { ChromiumConfig } from './browser-configs/chromium-config.ts'
import { EdgeConfig } from './browser-configs/edge-config.ts'
import { BraveConfig } from './browser-configs/brave-config.ts'
import { ArcConfig } from './browser-configs/arc-config.ts'

// Export types and interfaces
export type {
  TemplateVariables,
  PlatformConfig,
  BrowserParams,
  SupportedPlatform,
  SupportedArch,
} from './browser-base-config.ts'

/** Pre-configured Google Chrome browser instance */
export const chrome: ChromeConfig = new ChromeConfig()
/** Pre-configured Chromium browser instance */
export const chromium: ChromiumConfig = new ChromiumConfig()
/** Pre-configured Microsoft Edge browser instance */
export const edge: EdgeConfig = new EdgeConfig()
/** Pre-configured Brave browser instance */
export const brave: BraveConfig = new BraveConfig()
/** Pre-configured Arc browser instance */
export const arc: ArcConfig = new ArcConfig()

/**
 * Map of all supported browsers and their configurations.
 * Use this for programmatic access to browser configurations.
 */
export const BROWSERS = {
  chrome,
  chromium,
  edge,
  brave,
  arc,
} as const

/** Type representing the names of all supported browsers */
export type BrowserName = keyof typeof BROWSERS 