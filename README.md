# Browser Manager

Simple, error-proof, cross-platform, silent, and version specific browser installer. Can be used as a depedency free CLI, or a Deno library. Currently supports Chrome, Chromium, Edge, Brave, and Arc browsers, and works on Linux, Mac, and Windows.

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
curl -fsSL https://raw.githubusercontent.com/zackiles/browser-manager/main/install.sh | bash --remove
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
```

### As a Library

```typescript
import { chromium } from "jsr:@browser-tools/browser-manager"

// Install latest version of Chromium
await chromium.install({
  platform: "mac", // or "linux", "windows"
  arch: "arm64",   // or "x86_64"
})
```

## Features

- 🌐 Cross-platform support (macOS, Linux, Windows)
- 🏗️ Multiple architecture support (x86_64, arm64)
- 🔄 Automatic version detection and installation
- 🎯 Precise version targeting
- 🔒 Secure downloads with checksum verification
- 📦 Available as both a Deno/JSR library and CLI

## Supported Browsers

- Chromium
- Google Chrome
- Microsoft Edge
- Brave Browser
- Arc Browser

## License

MIT