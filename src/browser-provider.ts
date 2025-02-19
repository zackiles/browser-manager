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

// Export browser configurations
export const chrome: ChromeConfig = new ChromeConfig()
export const chromium: ChromiumConfig = new ChromiumConfig()
export const edge: EdgeConfig = new EdgeConfig()
export const brave: BraveConfig = new BraveConfig()
export const arc: ArcConfig = new ArcConfig()

// Export browser map for backward compatibility
export const BROWSERS = {
  chrome,
  chromium,
  edge,
  brave,
  arc,
} as const

// Export types based on the BROWSERS constant
export type BrowserName = keyof typeof BROWSERS 