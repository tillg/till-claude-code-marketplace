#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PLUGIN_DIR/.venv"

# Find a suitable Python 3 (prefer stable versions with pre-built wheels)
# Python 3.14+ often lacks pre-built wheels for packages like Pillow,
# causing build failures. We prefer 3.11-3.13 for reliability.
find_python() {
    # Check pyenv versions first (most likely to have stable versions)
    if command -v pyenv &>/dev/null; then
        local pyenv_root
        pyenv_root="$(pyenv root 2>/dev/null)" || true
        if [ -n "$pyenv_root" ]; then
            for ver_dir in "$pyenv_root"/versions/3.13.* "$pyenv_root"/versions/3.12.* "$pyenv_root"/versions/3.11.*; do
                if [ -x "$ver_dir/bin/python3" ] 2>/dev/null; then
                    echo "$ver_dir/bin/python3"
                    return
                fi
            done
        fi
    fi

    # Try specific stable version commands
    for cmd in python3.13 python3.12 python3.11; do
        if command -v "$cmd" &>/dev/null; then
            echo "$cmd"
            return
        fi
    done

    # Fall back to python3 (may be 3.14+ but worth trying)
    if command -v python3 &>/dev/null; then
        echo "python3"
        return
    fi

    echo ""
}

PYTHON="$(find_python)"
if [ -z "$PYTHON" ]; then
    echo "Error: Python 3 not found. Install Python 3.11-3.13:" >&2
    echo "  macOS: brew install python@3.13" >&2
    echo "  Linux: apt install python3" >&2
    exit 1
fi

echo "Using Python: $($PYTHON --version 2>&1)"

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    "$PYTHON" -m venv "$VENV_DIR"
fi

echo "Installing Python dependencies..."
"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install -r "$PLUGIN_DIR/requirements.txt" -q

echo "Setup complete."
