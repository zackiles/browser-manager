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
import { version as VERSION } from "../deno.jsonc" assert { type: "json" };

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
}

/**
 * Prints CLI usage information including available commands and examples
 */
const printUsage = () => {
  console.log(`
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
  --help                     Show this help message

Examples:
  browser-manager chrome install
  browser-manager edge install --version "120.0.6099.109"
  browser-manager brave remove --custom-base-path "/custom/path"
  browser-manager chromium getInstallationHistory
  browser-manager arc getLatestVersion
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
  console.log(`Successfully installed ${browserName}`);
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
  console.log(`Successfully removed ${browserName}`);
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
    console.log("No installation history found");
    return;
  }

  console.log("Installation History:");
  history.forEach((entry, index) => {
    console.log(`\nInstallation ${index + 1}:`);
    console.log(`  Browser: ${entry.browser}`);
    console.log(`  Version: ${entry.version ?? "unknown"}`);
    console.log(`  Platform: ${entry.platform}`);
    console.log(`  Architecture: ${entry.arch ?? "unknown"}`);
    console.log(`  Installation Date: ${entry.installDate}`);
    console.log(`  Base Path: ${entry.basePath}`);
    console.log(`  Custom Installation: ${entry.isCustomPath ? "Yes" : "No"}`);
  });
};

/**
 * Main CLI execution function
 */
const main = async () => {
  // Parse command line arguments
  const args = parseArgs(Deno.args, {
    string: ["version", "custom-base-path"],
    boolean: ["help"],
    alias: { h: "help", v: "version", p: "custom-base-path" },
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
    console.log(`Browser Manager v${VERSION}`);
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
        console.log(`Latest version of ${browserName}: ${latestVersion}`);
        break;
      }
    }
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    Deno.exit(1);
  }
};

// Execute if run directly
if (import.meta.main) {
  main();
}