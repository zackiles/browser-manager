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
export const chrome = new ChromeConfig()
export const chromium = new ChromiumConfig()
export const edge = new EdgeConfig()
export const brave = new BraveConfig()
export const arc = new ArcConfig()

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