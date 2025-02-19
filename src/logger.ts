/**
 * Logger module providing consistent logging across the application.
 * Supports different log levels and environment-specific behavior.
 * 
 * @module logger
 */

const isTestEnv =
  Deno.env.get('DENO_ENV') === 'test' || Deno.env.get('NODE_ENV') === 'test'

/** Logger interface providing consistent logging methods */
export const logger = {
  debug: (...args: unknown[]) => {
    if (isTestEnv || Deno.env.get('DEBUG')) console.debug(...args)
  },
  info: (...args: unknown[]) => {
    console.info(...args)
  },
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },
  error: (...args: unknown[]) => {
    console.error(...args)
  },
}
