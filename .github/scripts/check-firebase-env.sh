#!/usr/bin/env bash
#
# Fail the build when any VITE_FIREBASE_* value is missing or empty.
#
# GitHub expands `${{ secrets.X }}` to an empty string when no secret named X
# exists, rather than failing, so a typo in a secret name produces a green
# build that ships a broken Firebase config. That is not hypothetical: the
# auth domain secret was created as VITE_FIREBASE_AUTH_DOMAI (no trailing N),
# and every deploy between April and September 2026 shipped an empty
# authDomain, which breaks Google sign-in with auth/auth-domain-config-required.
#
# src/lib/firebase.js falls back to `<projectId>.firebaseapp.com` when the auth
# domain is empty, which keeps the app usable but also hides the misconfiguration.
# This check is what makes it visible.
set -euo pipefail

required=(
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET
  VITE_FIREBASE_MESSAGING_SENDER_ID
  VITE_FIREBASE_APP_ID
  VITE_FIREBASE_MEASUREMENT_ID
)

missing=()
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || missing+=("$name")
done

if (( ${#missing[@]} > 0 )); then
  echo "::error::Missing or empty repository secrets: ${missing[*]}"
  cat >&2 <<'EOF'

Each name listed above must exist under
  Settings > Secrets and variables > Actions
spelled exactly as the workflow references it. A `secrets.X` reference with no
matching secret becomes an empty string, so without this check the build would
succeed and deploy an app with a broken Firebase config.
EOF
  exit 1
fi

echo "All ${#required[@]} VITE_FIREBASE_* values are present."
