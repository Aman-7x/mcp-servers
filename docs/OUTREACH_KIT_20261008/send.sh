#!/usr/bin/env bash
# Compatibility entry point; maintained sender validates permission-based input.
set -euo pipefail
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$KIT_DIR/../.." && pwd)"
for arg in "$@"; do
  case "$arg" in
    --to|--subject|--body-file|--send)
      echo "The legacy send interface is retired. Use --input <targets.json> --dry-run with subscription evidence; see docs/OUTREACH_RESEND_SETUP.md." >&2
      exit 2 ;;
  esac
done
exec node "$ROOT/scripts/outreach_send.mjs" "$@"
