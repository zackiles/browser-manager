#!/usr/bin/env bash

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

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

# Get the final binary name after installation
get_installed_binary_name() {
    local os=$1
    if [ "$os" = "windows" ]; then
        echo "browser-manager.exe"
    else
        echo "browser-manager"
    fi
}

main() {
    print_step "Detecting platform..."
    read -r os arch < <(detect_platform)
    print_success "Detected $os ($arch)"

    local install_dir=$(get_install_dir "$os" "$INSTALL_DIR")
    local binary_name=$(get_installed_binary_name "$os")

    print_step "Removing browser-manager..."
    
    if [ -f "$install_dir/$binary_name" ]; then
        rm -f "$install_dir/$binary_name"
        print_success "Removed $binary_name from $install_dir"
    else
        print_error "browser-manager not found in $install_dir"
    fi

    # Clean up empty installation directory
    if [ -d "$install_dir" ] && [ -z "$(ls -A "$install_dir")" ]; then
        rmdir "$install_dir"
        print_success "Removed empty installation directory"
    fi

    print_success "browser-manager has been removed successfully!"
}

main "$@" 