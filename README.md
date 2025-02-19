# Browser Manager

Simple, error-proof, cross-platform, silent, and version specific browser installer. Can be used as a depedency free CLI, or a Deno library. Currently supports Chrome, Chromium, Edge, Brave, and Arc browsers, and works on Linux, Mac, and Windows.

## Features

- 🌐 Cross-platform support (macOS, Linux, Windows)
- 🏗️ Multiple architecture support (x86_64, arm64)
- 🔄 Automatic version detection and installation
- 🎯 Precise version targeting
- 🔒 Secure downloads with checksum verification
- 📦 Available as both a Deno/JSR library and CLI

## Quick Start

### As a CLI

Install the native binary:

```bash
# Using curl
curl -fsSL https://raw.githubusercontent.com/zackiles/browser-manager/main/install.sh | bash

# Or using wget
wget -qO- https://raw.githubusercontent.com/zackiles/browser-manager/main/install.sh | bash
```

To remove the installed binary, run:

```bash
# Using curl
curl -fsSL https://raw.githubusercontent.com/zackiles/browser-manager/main/remove.sh | bash

# Or using wget
wget -qO- https://raw.githubusercontent.com/zackiles/browser-manager/main/remove.sh | bash
```

Then use the CLI:

```bash
# Basic usage
browser-manager <browser> <command> [options]

# Examples
browser-manager chrome install                    # Install latest Chrome version
browser-manager edge install --version "120.0.6099.109"  # Install specific Edge version
browser-manager brave remove                      # Remove Brave browser
browser-manager chromium getInstallationHistory   # View Chromium installation history
browser-manager arc getLatestVersion             # Get latest Arc version
browser-manager version                          # Display CLI version

# Available commands
install               # Install a browser
remove               # Remove a browser
getInstallationHistory  # View installation history
getLatestVersion     # Get latest available version (as a string)
version              # Display CLI version

# Options
--version <version>         # Specify version to install
--custom-base-path <path>  # Use custom installation path
--help                     # Show help message
--silent                   # Disable all non-error output (by default, debug logs are enabled)
```

### As a Library

```typescript
import { chromium } from "jsr:@browser-tools/browser-manager"

// Enable debug logs (optional)
// By default, only errors are shown. Set this to see progress bars and debug info.
Deno.env.set('BROWSER_MANAGER_DEBUG', '1')

// Install latest version of Chromium (platform and arch auto-detected)
await chromium.install()

// Or specify platform/arch manually if needed
await chromium.install({
  platform: "mac",    // Optional: "mac" | "linux" | "windows"
  arch: "arm64",      // Optional: "arm64" | "x64"
})
```

### Browser Methods

Each browser instance (`chrome`, `chromium`, `edge`, `brave`, `arc`) exposes the following methods:

#### install(params?)
Install a specific version of the browser. Platform and architecture are automatically detected if not specified.

```typescript
import { chrome, type BrowserParams } from "jsr:@browser-tools/browser-manager"

// Install latest version with auto-detected platform/arch
await chrome.install()

// Install with specific version
await chrome.install({
  version: "120.0.6099.109"
})

// Install with all options specified
await chrome.install({
  platform: "windows",  // Optional: auto-detected if not specified
  arch: "x64",         // Optional: auto-detected if not specified
  version: "120.0.6099.109",
  customBasePath: "/custom/install/path"  // Optional
})
```

**Important Notes:**

1. **Arc Browser Limitations**: Arc browser only supports installing the latest version. The `version` parameter is ignored for Arc installations as the browser auto-updates to the latest version.

2. **Installation Methods**: Browsers are installed differently depending on the type:
   - Chromium: Direct archive extraction to the installation path
   - Chrome, Edge, Brave: Require running platform-specific installers
   - Installation method is handled automatically based on the browser type

3. **Version Resolution**: If a specific version isn't found, the system will attempt to find and install the closest available version (rounding up). For example, requesting version "119.0.0" might install "119.0.2" if that's the closest available version.

4. **Platform & Architecture**: By default, the system automatically detects your operating system and CPU architecture. You only need to specify these if you want to install for a different platform or architecture than your current system.

#### remove(params?)
Remove an installed browser. Platform and architecture are automatically detected if not specified.

```typescript
// Remove latest installation with auto-detected platform/arch
await edge.remove()

// Remove specific version
await edge.remove({
  version: "120.0.6099.109"
})

// Remove with all options specified
await edge.remove({
  platform: "linux",  // Optional: auto-detected if not specified
  arch: "x64",       // Optional: auto-detected if not specified
  version: "120.0.6099.109"
})
```

#### getInstallationHistory(params?)
Get history of all installations for a browser. Platform and architecture are automatically detected if not specified.

```typescript
// Get history for current platform/arch
const history = await brave.getInstallationHistory()

// Get history for specific platform/arch
const history = await brave.getInstallationHistory({
  platform: "mac",  // Optional: auto-detected if not specified
  arch: "arm64"    // Optional: auto-detected if not specified
})

// Returns array of InstallationInfo:
// [{
//   browser: string,
//   version: string,
//   platform: string,
//   arch: string,
//   downloadUrl: string,
//   isCustomPath: boolean,
//   basePath: string,
//   installDate: string
// }]
```

#### getLatestVersion(platform?, arch?)
Get the latest available version for a browser. Platform and architecture are automatically detected if not specified.

```typescript
// Get latest version for current platform/arch
const version = await arc.getLatestVersion()

// Get latest version for specific platform/arch
const version = await arc.getLatestVersion("mac", "arm64")
// Returns version string, e.g. "1.21.1"
```

### Types

The library exports several TypeScript types for better type safety:

```typescript
type SupportedPlatform = "windows" | "mac" | "linux"
type SupportedArch = "x64" | "arm64"

interface BrowserParams {
  platform: string
  version?: string
  arch?: string
  basePath?: string
  installPath?: string
  customBasePath?: string
}

interface InstallationInfo {
  browser: string
  version?: string
  platform: string
  arch?: string
  downloadUrl: string
  isCustomPath: boolean
  basePath: string
  installDate: string
}
```

### Error Handling

All methods can throw errors for various reasons:
- Invalid platform/architecture combinations
- Network issues during downloads
- Installation failures
- Invalid versions
- File system permission issues

It's recommended to wrap calls in try/catch blocks:

```typescript
try {
  await chromium.install({
    platform: "mac",
    arch: "arm64"
  })
} catch (error) {
  console.error("Installation failed:", error.message)
}
```

## Supported Browsers

- Chromium
- Google Chrome
- Microsoft Edge
- Brave Browser
- Arc Browser

## License

MIT