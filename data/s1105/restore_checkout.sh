#!/bin/bash
# s1105: restore MCP checkout after the owner runs `stripe login`.
# Rotates only the STRIPE_SECRET_KEY secret on the mcp-billing worker (no code change), then probes one tagged POST.
# The key never prints. Rollback: put the previous secret back is impossible (it is expired), so there is nothing to roll back.
set -eu
K=$(security find-generic-password -s StripeCLI -a default.live_mode_api_key -w 2>/dev/null || true)
[ -n "$K" ] || { echo "no live key in keychain; run: stripe login"; exit 2; }
case "$K" in rk_live_*|sk_live_*) ;; *) echo "key is not live mode"; exit 3;; esac
cd /Users/mike/mcp-servers/billing
prev=$(timeout 60 npx wrangler deployments list 2>/dev/null | /usr/bin/grep -oE '[0-9a-f]{8}-[0-9a-f-]{27}' | tail -1 || true)
echo "previous version: ${prev:-unknown}"
printf '%s' "$K" | timeout 120 npx wrangler secret put STRIPE_SECRET_KEY 2>&1 | /usr/bin/grep -v -i "key" | tail -2
unset K
sleep 10
# one tagged probe, same form as data/s1105/reports/paid-path.json
/usr/bin/grep -n "probe" /Users/mike/mcp-servers/data/s1105/reports/paid-path.json | head -3
echo "now run the exact probe command recorded in paid-path.json for invoice; expect 303 to checkout.stripe.com"
echo "then ship the merged billing changes (PR 116, PR 123) through the gate from a clean origin/main worktree:"
echo "  git -C ~/mcp-servers worktree add ~/mcp-servers-work/billing-deploy origin/main && cd ~/mcp-servers-work/billing-deploy/billing && npm run deploy"
