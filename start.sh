#!/bin/bash
# MediPulse QR Startup Script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Ensure local node binary symlink exists
if [ ! -f "$DIR/bin/node" ]; then
  mkdir -p "$DIR/bin"
  ln -sf "/Users/sicilliac/Library/Application Support/Antigravity/bin/agy-node" "$DIR/bin/node"
fi

echo "=========================================================="
echo "  MediPulse QR: Emergency Patient Care & Clinical Portal  "
echo "=========================================================="
echo "Starting local healthcare server on http://localhost:3000 ..."
exec "$DIR/bin/node" "$DIR/server.js"
