/**
 * Logger module providing consistent logging across the application.
 * Supports different log levels and environment-specific behavior.
 * Debug output is only shown when BROWSER_MANAGER_DEBUG=1 is set.
 * 
 * @module logger
 */

import ProgressBar from '@deno-library/progress'

const isDebugMode = Deno.env.get('BROWSER_MANAGER_DEBUG') === '1'
const isTestEnv = Deno.env.get('DENO_ENV') === 'test' || Deno.env.get('NODE_ENV') === 'test'
const shouldShowProgress = isDebugMode || isTestEnv

/** Logger interface providing consistent logging methods */
export const logger = {
  debug: (...args: unknown[]) => {
    if (isDebugMode || isTestEnv) console.debug(...args)
  },
  info: (...args: unknown[]) => {
    if (isDebugMode || isTestEnv) console.info(...args)
  },
  warn: (...args: unknown[]) => {
    if (isDebugMode || isTestEnv) console.warn(...args)
  },
  error: (...args: unknown[]) => {
    // Errors are always shown
    console.error(...args)
  },
  /**
   * Creates a progress bar for tracking download or extraction progress.
   * Only shows progress if debug mode is enabled.
   */
  createProgressBar: ({
    title,
    total,
  }: {
    title: string;
    total: number;
  }): ProgressBar | undefined => {
    if (!shouldShowProgress) return undefined

    return new ProgressBar({
      title,
      total,
      display: ':completed/:total :percent [:bar] :bytesPerSecond',
      complete: '=',
      incomplete: '-',
    })
  },
  /**
   * Updates progress bar if it exists, otherwise does nothing.
   */
  updateProgress: (progress: ProgressBar | undefined, value: number) => {
    if (progress) {
      progress.render(value)
    }
  },
  /**
   * Ends progress bar if it exists, otherwise does nothing.
   */
  endProgress: (progress: ProgressBar | undefined) => {
    if (progress) {
      progress.end()
    }
  }
}
