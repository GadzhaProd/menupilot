#!/usr/bin/env sh
# Run the official 21st.dev CLI with the project's API key.
# The key lives in .env.local (git-ignored): TWENTYFIRST_TOKEN=21st_sk_...
# Usage: sh scripts/21st.sh search "pricing table" --limit 5
#        sh scripts/21st.sh get <id>        # React/shadcn code of a component
#        sh scripts/21st.sh theme <id>      # theme CSS
#        sh scripts/21st.sh usage
set -eu
cd "$(dirname "$0")/.."
# Agents work in git worktrees without the ignored .env.local;
# fall back to the main checkout (parent of the shared .git directory).
ENV_FILE=.env.local
if [ ! -f "$ENV_FILE" ]; then
  COMMON_DIR=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)
  ENV_FILE="$(dirname "${COMMON_DIR:-.}")/.env.local"
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env.local with TWENTYFIRST_TOKEN (ask the coordinator)." >&2
  exit 1
fi
set -a
. "$ENV_FILE"
set +a
# Node's fetch ignores HTTP(S)_PROXY unless this is set (needed in sandboxes).
export NODE_USE_ENV_PROXY=1
export npm_config_cache="${TMPDIR:-/tmp}/npm-cache-21st"
exec npx -y @21st-dev/cli@1.18.0 "$@"
