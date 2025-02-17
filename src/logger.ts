import 'jsr:@std/dotenv'

const isTestEnv =
  Deno.env.get('DENO_ENV') === 'test' || Deno.env.get('NODE_ENV') === 'test'

export const logger = {
  debug: (...args: unknown[]) => {
    if (isTestEnv) console.debug(...args)
  },
  info: (...args: unknown[]) => {
    if (isTestEnv) console.info(...args)
  },
  warn: (...args: unknown[]) => {
    if (isTestEnv) console.warn(...args)
  },
  error: (...args: unknown[]) => {
    if (isTestEnv) console.error(...args)
  },
}
