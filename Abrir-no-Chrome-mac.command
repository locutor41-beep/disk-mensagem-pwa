#!/usr/bin/env bash
# Abrir no Google Chrome (macOS)
cd "$(dirname "$0")"
open -a "Google Chrome" "./index.html" 2>/dev/null || open "./index.html"
