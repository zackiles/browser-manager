#!/usr/bin/env bash

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Base URL for binary downloads
BASE_URL="https://github.com/zackiles/browser-manager/blob/main/bin"

print_step() {
    echo -e "${BLUE}==>${NC} ${BOLD}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

# Detect OS and architecture
detect_platform() {
    local os arch

    # Detect OS
    case "$(uname -s)" in
        Darwin*)  os="macos" ;;
        Linux*)   os="linux" ;;
        MINGW*|MSYS*|CYGWIN*) os="windows" ;;
        *)        print_error "Unsupported operating system" ;;
    esac

    # Detect architecture
    case "$(uname -m)" in
        x86_64|amd64) arch="x86_64" ;;
        arm64|aarch64) 
            if [ "$os" = "macos" ]; then
                arch="arm64"
            else
                print_error "ARM64 is only supported on macOS"
            fi
            ;;
        *)          print_error "Unsupported architecture" ;;
    esac

    echo "$os" "$arch"
}

# Get binary name based on platform
get_binary_name() {
    local os=$1
    local arch=$2
    local suffix=""

    case "$os" in
        "macos")
            if [ "$arch" = "arm64" ]; then
                suffix="macos-arm64"
            else
                suffix="macos-x86_64"
            fi
            ;;
        "linux")   suffix="linux-x86_64" ;;
        "windows") suffix="windows-x86_64.exe" ;;
    esac

    echo "browser-manager-$suffix"
}

# Get the final binary name after installation
get_installed_binary_name() {
    local os=$1
    if [ "$os" = "windows" ]; then
        echo "browser-manager.exe"
    else
        echo "browser-manager"
    fi
}

# Get the appropriate installation directory for the platform
get_install_dir() {
    local os=$1
    local custom_dir=$2

    if [ -n "$custom_dir" ]; then
        echo "$custom_dir"
        return
    fi

    case "$os" in
        "macos"|"linux")
            echo "$HOME/.local/bin"
            ;;
        "windows")
            echo "$HOME/AppData/Local/Programs/browser-manager"
            ;;
    esac
}

# Add directory to PATH in the appropriate shell config file
add_to_path() {
    local install_dir=$1
    local os=$2
    local shell_config

    case "$os" in
        "macos"|"linux")
            if [ -f "$HOME/.zshrc" ]; then
                shell_config="$HOME/.zshrc"
            elif [ -f "$HOME/.bashrc" ]; then
                shell_config="$HOME/.bashrc"
            else
                shell_config="$HOME/.profile"
            fi
            ;;
        "windows")
            # On Windows, we'll modify the user PATH environment variable
            if command -v setx >/dev/null 2>&1; then
                setx PATH "%PATH%;$install_dir" >/dev/null 2>&1
                return
            else
                print_error "Unable to modify PATH on Windows"
            fi
            ;;
    esac

    if [ "$os" != "windows" ]; then
        if ! grep -q "export PATH=\"$install_dir:\$PATH\"" "$shell_config" 2>/dev/null; then
            echo "export PATH=\"$install_dir:\$PATH\"" >> "$shell_config"
            print_success "Added $install_dir to PATH in $shell_config"
        fi
    fi
}

remove_installation() {
    print_step "Removing browser-manager..."
    local os arch
    read -r os arch < <(detect_platform)
    local install_dir=$(get_install_dir "$os")
    local binary_name=$(get_binary_name "$os" "$arch")

    rm -f "$install_dir/$binary_name"
    print_success "Removed $binary_name from $install_dir"

    if [ "$os" = "windows" ]; then
        rm -f "$install_dir/browser-manager"
    fi

    print_success "browser-manager has been removed successfully!"
}

main() {
    if [ "$1" = "--remove" ]; then
        remove_installation
        exit 0
    fi

    print_step "Detecting platform..."
    read -r os arch < <(detect_platform)
    print_success "Detected $os ($arch)"

    download_binary_name=$(get_binary_name "$os" "$arch")
    installed_binary_name=$(get_installed_binary_name "$os")
    install_dir=$(get_install_dir "$os" "$INSTALL_DIR")
    download_url="$BASE_URL/$download_binary_name"

    print_step "Creating installation directory..."
    mkdir -p "$install_dir"
    print_success "Created $install_dir"

    print_step "Downloading browser-manager..."
    if command -v curl >/dev/null 2>&1; then
        curl -L -o "$install_dir/$download_binary_name" "$download_url" || print_error "Download failed"
    elif command -v wget >/dev/null 2>&1; then
        wget -O "$install_dir/$download_binary_name" "$download_url" || print_error "Download failed"
    else
        print_error "Neither curl nor wget found"
    fi
    print_success "Downloaded browser-manager"

    print_step "Setting permissions and renaming binary..."
    chmod +x "$install_dir/$download_binary_name"
    mv "$install_dir/$download_binary_name" "$install_dir/$installed_binary_name"
    print_success "Set executable permissions and renamed binary"

    print_step "Updating PATH..."
    add_to_path "$install_dir" "$os"
    print_success "Updated PATH"

    echo
    print_success "browser-manager has been installed successfully!"
    echo
    echo -e "${BOLD}To start using browser-manager:${NC}"
    echo "1. Restart your terminal or run: source ~/.bashrc (or your shell's config file)"
    echo "2. Run: browser-manager --help"
    echo
    echo -e "${BOLD}Installation Details:${NC}"
    echo "• Binary: $install_dir/$installed_binary_name"
    echo "• Version: latest"
    echo
}

main "$@" 