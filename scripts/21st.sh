#!/usr/bin/env sh
# Run the official 21st.dev CLI with the project's API key.
# The key lives in .env.local (git-ignored): TWENTYFIRST_TOKEN=21st_sk_...
# Usage: sh scripts/21st.sh search "pricing table" --limit 5
#        sh scripts/21st.sh get <id>        # React/shadcn code of a component
#        sh scripts/21st.sh theme <id>      # theme CSS
#        sh scripts/21st.sh usage
#        sh scripts/21st.sh license @author/components/slug   # Author/Library/License
set -eu
cd "$(dirname "$0")/.."
# License lookup: the CLI does not expose licenses; the component page does.
# Usage: sh scripts/21st.sh license @originui/components/dialog   (path from the "url" field)
if [ "${1:-}" = "license" ]; then
  path="${2:?usage: 21st.sh license @author/components/slug}"
  path="${path#https://21st.dev/}"
  page=$(curl -fsS "https://21st.dev/${path}.md") || { echo "Could not fetch https://21st.dev/${path}.md" >&2; exit 1; }
  printf '%s\n' "$page" | grep -E '^- (Author|Library|License):' || echo "License: unknown (no metadata)"
  exit 0
fi
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
