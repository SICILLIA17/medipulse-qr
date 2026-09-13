#!/bin/bash
# MediPulse QR Startup Script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  MediPulse QR: Emergency Patient Care & Clinical Portal  "
echo "=========================================================="
echo "Starting local healthcare server on http://localhost:3000 ..."

if command -v node >/dev/null 2>&1; then
  exec node "$DIR/server.js"
elif [ -f "$DIR/bin/node" ]; then
  exec "$DIR/bin/node" "$DIR/server.js"
else
  echo "Error: Node.js runtime not found."
  exit 1
fi

