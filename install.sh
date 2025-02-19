#!/usr/bin/env bash

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Base URL for binary downloads
BASE_URL="https://github.com/zackiles/browser-manager/releases/latest/download"

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

# Verify if a path is in the PATH environment variable
verify_path_in_env() {
    local dir=$1
    echo "$PATH" | tr ':' '\n' | grep -Fx "$dir" >/dev/null 2>&1
}

# Check if binary is accessible from PATH
verify_binary_accessible() {
    local binary_name=$1
    command -v "$binary_name" >/dev/null 2>&1
}

# Get the appropriate shell config file
get_shell_config_file() {
    if [ -n "$SHELL" ]; then
        case "$SHELL" in
            */zsh) 
                if [ -f "$HOME/.zshrc" ]; then
                    echo "$HOME/.zshrc"
                    return
                fi
                ;;
            */bash)
                if [ -f "$HOME/.bashrc" ]; then
                    echo "$HOME/.bashrc"
                    return
                fi
                ;;
        esac
    fi

    # Fallback checks
    if [ -f "$HOME/.zshrc" ]; then
        echo "$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        echo "$HOME/.bashrc"
    else
        echo "$HOME/.profile"
    fi
}

# Add directory to PATH with user confirmation
add_to_path_with_prompt() {
    local install_dir=$1
    local os=$2
    local binary_name=$3
    local shell_config

    if [ "$os" = "windows" ]; then
        if ! verify_path_in_env "$install_dir"; then
            if command -v setx >/dev/null 2>&1; then
                setx PATH "%PATH%;$install_dir" >/dev/null 2>&1
                print_success "Added $install_dir to PATH"
                echo "Please restart your terminal for the changes to take effect."
            else
                echo -e "${BOLD}Warning: Unable to modify PATH on Windows. Please add $install_dir to your PATH manually.${NC}"
            fi
        fi
    else
        shell_config=$(get_shell_config_file)
        
        if ! verify_path_in_env "$install_dir"; then
            # Check if we're running in a pipe (non-interactive)
            if [ -t 0 ]; then
                # Interactive mode
                echo -e "${BOLD}The installation directory is not in your PATH.${NC}"
                echo -n "Would you like to add it to your PATH in $shell_config? [Y/n] "
                read -r response
                response=${response:-Y}
                if [[ "$response" =~ ^[Yy] ]]; then
                    # Add a newline if the file doesn't end with one
                    [ -f "$shell_config" ] && [ -s "$shell_config" ] && tail -c1 "$shell_config" | read -r _ || echo "" >> "$shell_config"
                    # Add the PATH modification with a comment
                    {
                        echo "# Added by browser-manager installer"
                        echo "export PATH=\"\${PATH:+\${PATH}:}$install_dir\""
                    } >> "$shell_config"
                    print_success "Added $install_dir to PATH in $shell_config"
                    echo "Please run 'source $shell_config' or restart your terminal for the changes to take effect."
                fi
            else
                # Non-interactive mode (e.g., curl | bash)
                # Add a newline if the file doesn't end with one
                [ -f "$shell_config" ] && [ -s "$shell_config" ] && tail -c1 "$shell_config" | read -r _ || echo "" >> "$shell_config"
                # Add the PATH modification with a comment
                {
                    echo "# Added by browser-manager installer"
                    echo "export PATH=\"\${PATH:+\${PATH}:}$install_dir\""
                } >> "$shell_config"
                print_success "Added $install_dir to PATH in $shell_config"
                echo "Please run 'source $shell_config' or restart your terminal for the changes to take effect."
            fi
        fi
    fi
}

# Verify installation and PATH setup
verify_installation() {
    local install_dir=$1
    local os=$2
    local binary_name=$3

    # First check if binary is already accessible
    if verify_binary_accessible "$binary_name"; then
        print_success "$binary_name is already properly installed and accessible from PATH"
        return
    fi

    # Only proceed with PATH modification if binary isn't accessible
    echo -e "${BOLD}Warning: $binary_name is not accessible from PATH${NC}"
    add_to_path_with_prompt "$install_dir" "$os" "$binary_name"
}

main() {
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
        echo "Download URL: $download_url"
        curl -v -L -o "$install_dir/$download_binary_name" "$download_url" || print_error "Download failed"
        echo "Downloaded file contents (first few lines):"
        head -n 5 "$install_dir/$download_binary_name" || true
        file "$install_dir/$download_binary_name" || true
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

    print_step "Verifying installation..."
    verify_installation "$install_dir" "$os" "$installed_binary_name"

    echo
    print_success "browser-manager has been installed successfully!"
    echo
    echo -e "${BOLD}To start using browser-manager:${NC}"
    if [ "$os" != "windows" ]; then
        shell_config=$(get_shell_config_file)
        echo "1. Run: source $shell_config"
    else
        echo "1. Restart your terminal"
    fi
    echo "2. Run: browser-manager --help"
    echo
    echo -e "${BOLD}Installation Details:${NC}"
    echo "• Binary: $install_dir/$installed_binary_name"
    echo "• Version: latest"
    echo
}

main "$@" 