import '@std/dotenv'

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
} from './browser-base-config.ts'

export { install, remove } from './installer.ts'
