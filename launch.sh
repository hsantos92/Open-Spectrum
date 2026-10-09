#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
exec ./node_modules/electron/dist/electron . --ozone-platform=wayland "$@"
