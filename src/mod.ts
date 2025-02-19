import '@std/dotenv'
import type { ChromeConfig } from './browser-configs/chrome-config.ts'
import type { ChromiumConfig } from './browser-configs/chromium-config.ts'
import type { EdgeConfig } from './browser-configs/edge-config.ts'
import type { BraveConfig } from './browser-configs/brave-config.ts'
import type { ArcConfig } from './browser-configs/arc-config.ts'

export {
  chrome,
  chromium,
  edge,
  brave,
  arc,
} from './browser-provider.ts'

export type {
  BaseBrowserConfig as BrowserConfig,
  BrowserParams,
  TemplateVariables,
  PlatformConfig,
  SupportedPlatform,
  SupportedArch,
  InstallationInfo,
  InstallArgs,
} from './browser-base-config.ts'

// Re-export browser config types for better type inference
export type {
  ChromeConfig,
  ChromiumConfig,
  EdgeConfig,
  BraveConfig,
  ArcConfig,
}
