/**
 * Browser Manager CLI
 * Command-line interface for managing browser installations and configurations.
 * Supports installation, removal, version checking, and history viewing for multiple browsers.
 * 
 * @module cli
 */
import { parseArgs } from "@std/cli/parse-args";
import {
  chrome,
  chromium,
  edge,
  brave,
  arc,
  type BrowserConfig,
  type BrowserParams,
} from "../src/mod.ts";
import { getCurrentArch, getCurrentPlatform } from "../src/utils.ts";
import { logger } from "../src/logger.ts";

// Read version from embedded deno.json file
const VERSION = JSON.parse(Deno.readTextFileSync(new URL("../deno.json", import.meta.url))).version;

// Constants
const BROWSERS = {
  chrome,
  chromium,
  edge,
  brave,
  arc,
} as const;

const SUPPORTED_COMMANDS = [
  "install",
  "remove",
  "getInstallationHistory",
  "getLatestVersion",
  "version",
] as const;

// Types
type Command = typeof SUPPORTED_COMMANDS[number];

interface CliArgs {
  version?: string;
  "custom-base-path"?: string;
  help?: boolean;
  silent?: boolean;
}

/**
 * Prints CLI usage information including available commands and examples
 */
const printUsage = () => {
  logger.info(`
Browser Manager v${VERSION}

Usage: browser-manager <browser> <command> [options]

Browsers:
  ${Object.keys(BROWSERS).join(", ")}

Commands:
  install               Install the specified browser
  remove               Remove the specified browser
  getInstallationHistory  Get installation history for the browser
  getLatestVersion     Get the latest version available for the browser (as a string)
  version              Display Browser Manager version

Options:
  --version <version>         Specify the version to install
  --custom-base-path <path>  Specify a custom installation path
  --silent                   Disable all non-error output
  --help                     Show this help message

Examples:
  browser-manager chrome install
  browser-manager edge install --version "120.0.6099.109"
  browser-manager brave remove --custom-base-path "/custom/path"
  browser-manager chromium getInstallationHistory
  browser-manager arc getLatestVersion --silent
  browser-manager version
`);
};

/**
 * Prompts user for browser version when not provided via command line
 * @returns {Promise<string>} The version string entered by the user
 * @throws {Error} If no version is provided
 */
const promptForVersion = async (): Promise<string> => {
  const versionPrompt = prompt("Enter the version to install: ");
  if (!versionPrompt) {
    throw new Error("Version is required");
  }
  return versionPrompt;
};

/**
 * Handles browser installation command
 * @param {object} params - Installation parameters
 */
const handleInstall = async ({ browser, browserName, platform, arch, version, customBasePath }: {
  browser: BrowserConfig;
  browserName: string;
  platform: string;
  arch: string;
  version: string;
  customBasePath?: string;
}) => {
  const params: BrowserParams = { platform, arch, version, customBasePath };
  await browser.install(params);
  logger.info(`Successfully installed ${browserName}`);
};

/**
 * Handles browser removal command
 * @param {object} params - Removal parameters
 */
const handleRemove = async ({ browser, browserName, platform, arch, customBasePath }: {
  browser: BrowserConfig;
  browserName: string;
  platform: string;
  arch: string;
  customBasePath?: string;
}) => {
  const params: BrowserParams = { platform, arch, customBasePath };
  await browser.remove(params);
  logger.info(`Successfully removed ${browserName}`);
};

/**
 * Handles installation history command
 * @param {object} params - History retrieval parameters
 */
const handleHistory = async ({ browser, platform, arch, customBasePath }: {
  browser: BrowserConfig;
  platform: string;
  arch: string;
  customBasePath?: string;
}) => {
  const params: BrowserParams = { platform, arch, customBasePath };
  const history = await browser.getInstallationHistory(params);
  if (history.length === 0) {
    logger.info("No installation history found");
    return;
  }

  logger.info("Installation History:");
  history.forEach((entry, index) => {
    logger.info(`\nInstallation ${index + 1}:`);
    logger.info(`  Browser: ${entry.browser}`);
    logger.info(`  Version: ${entry.version ?? "unknown"}`);
    logger.info(`  Platform: ${entry.platform}`);
    logger.info(`  Architecture: ${entry.arch ?? "unknown"}`);
    logger.info(`  Installation Date: ${entry.installDate}`);
    logger.info(`  Base Path: ${entry.basePath}`);
    logger.info(`  Custom Installation: ${entry.isCustomPath ? "Yes" : "No"}`);
  });
};

/**
 * Main CLI execution function
 */
const main = async () => {
  // Set debug mode by default unless --silent is specified
  if (Deno.args.indexOf('--silent') === -1) {
    Deno.env.set('BROWSER_MANAGER_DEBUG', '1')
  }

  // Parse command line arguments
  const args = parseArgs(Deno.args, {
    string: ["version", "custom-base-path"],
    boolean: ["help", "silent"],
    alias: { h: "help", v: "version", p: "custom-base-path", s: "silent" },
  });

  // Show help if requested or no arguments provided
  if (args.help || Deno.args.length === 0) {
    printUsage();
    Deno.exit(0);
  }

  // Get browser and command from positional arguments
  const [browserName, command] = args._;

  // Handle version command separately as it doesn't require a browser
  if (command === "version") {
    logger.info(`Browser Manager v${VERSION}`);
    Deno.exit(0);
  }

  // Validate browser
  if (!browserName || typeof browserName !== "string") {
    logger.error("Browser name is required");
    printUsage();
    Deno.exit(1);
  }

  if (!(browserName in BROWSERS)) {
    logger.error(`Invalid browser "${browserName}". Supported browsers: ${Object.keys(BROWSERS).join(", ")}`);
    Deno.exit(1);
  }

  // Validate command
  if (!command || typeof command !== "string") {
    logger.error("Command is required");
    printUsage();
    Deno.exit(1);
  }

  if (!SUPPORTED_COMMANDS.includes(command as Command)) {
    logger.error(`Invalid command "${command}". Supported commands: ${SUPPORTED_COMMANDS.join(", ")}`);
    Deno.exit(1);
  }

  // Get browser instance and system info
  const browser = BROWSERS[browserName as keyof typeof BROWSERS];
  const platform = getCurrentPlatform();
  const arch = getCurrentArch();
  const { version, "custom-base-path": customBasePath } = args;

  try {
    switch (command as Command) {
      case "install": {
        const browserVersion = version ?? await promptForVersion();
        await handleInstall({ browser, browserName, platform, arch, version: browserVersion, customBasePath });
        break;
      }
      case "remove": {
        await handleRemove({ browser, browserName, platform, arch, customBasePath });
        break;
      }
      case "getInstallationHistory": {
        await handleHistory({ browser, platform, arch, customBasePath });
        break;
      }
      case "getLatestVersion": {
        const latestVersion = await browser.getLatestVersion(platform, arch);
        logger.info(`Latest version of ${browserName}: ${latestVersion}`);
        break;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
    } else {
      logger.error(`An unknown error occurred: ${String(error)}`);
    }
    Deno.exit(1);
  }
};

// Execute if run directly
if (import.meta.main) {
  main();
}