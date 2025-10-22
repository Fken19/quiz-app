#!/usr/bin/env bash
set -euo pipefail
OUTFILE="$HOME/docker_diag_output.txt"
echo "=== docker diag started: $(date -u) ===" > "$OUTFILE"

echo "--- Shell info ---" | tee -a "$OUTFILE"
echo "USER=$(whoami)" | tee -a "$OUTFILE"
echo "SHELL=$SHELL" | tee -a "$OUTFILE"
echo "Non-login shell 'which docker':" | tee -a "$OUTFILE"
which docker 2>/dev/null || echo "no-docker-found" | tee -a "$OUTFILE"
echo "docker --version (non-login):" | tee -a "$OUTFILE"
(docker --version 2>&1) || echo "no docker binary" | tee -a "$OUTFILE"
echo "docker compose version (non-login):" | tee -a "$OUTFILE"
(docker compose version 2>&1) || echo "no docker compose" | tee -a "$OUTFILE"

echo "" | tee -a "$OUTFILE"
echo "--- Check login shell environment (subshell) ---" | tee -a "$OUTFILE"
if [ -n "$SHELL" ]; then
  SH="$SHELL"
else
  SH="/bin/zsh"
fi
# run as login shell (-l) and execute checks
echo "Running $SH -lc 'which docker; docker --version; docker compose version' ..." | tee -a "$OUTFILE"
$SH -lc "which docker 2>/dev/null || echo no-docker-found; docker --version 2>&1 || echo no-docker-binary; docker compose version 2>&1 || echo no-docker-compose" | tee -a "$OUTFILE"

echo "" | tee -a "$OUTFILE"
echo "--- PATH and common locations ---" | tee -a "$OUTFILE"
echo "PATH=$PATH" | tee -a "$OUTFILE"
echo "Check common locations:" | tee -a "$OUTFILE"
for p in /opt/homebrew/bin/docker /usr/local/bin/docker /Applications/Docker\ Desktop.app/Contents/Resources/bin/docker /Applications/Docker.app/Contents/Resources/bin/docker; do
  if [ -e "$p" ]; then
    echo "FOUND: $p" | tee -a "$OUTFILE"
  else
    echo "missing: $p" | tee -a "$OUTFILE"
  fi
done

echo "" | tee -a "$OUTFILE"
# Try to locate docker binary via mdfind (mac Spotlight) as fallback (may be slow)
echo "Searching for docker binary via 'mdfind' (may take a moment)..." | tee -a "$OUTFILE"
if command -v mdfind >/dev/null 2>&1; then
  mdfind "kMDItemFSName == 'docker' && kMDItemKind == 'Unix executable' " 2>/dev/null | head -n 10 | tee -a "$OUTFILE" || true
else
  echo "mdfind not available" | tee -a "$OUTFILE"
fi

echo "" | tee -a "$OUTFILE"
# If docker not found in PATH but exists inside app bundle, propose symlink
APP_BIN=""
if [ -e "/Applications/Docker Desktop.app/Contents/Resources/bin/docker" ]; then
  APP_BIN="/Applications/Docker Desktop.app/Contents/Resources/bin/docker"
elif [ -e "/Applications/Docker.app/Contents/Resources/bin/docker" ]; then
  APP_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"
fi

if [ -n "$APP_BIN" ]; then
  echo "Docker Desktop embedded binary found: $APP_BIN" | tee -a "$OUTFILE"
  # choose target dir: prefer /usr/local/bin, fallback to /opt/homebrew/bin if exists
  if [ -d "/usr/local/bin" ]; then
    TARGET_DIR="/usr/local/bin"
  elif [ -d "/opt/homebrew/bin" ]; then
    TARGET_DIR="/opt/homebrew/bin"
  else
    TARGET_DIR="/usr/local/bin"
  fi
  echo "Proposed symlink target dir: $TARGET_DIR" | tee -a "$OUTFILE"
  # only create symlink if binary not already available in PATH
  if command -v docker >/dev/null 2>&1; then
    echo "docker already available in PATH, skipping symlink." | tee -a "$OUTFILE"
  else
    echo ""
    read -p "Create sudo symlink $APP_BIN -> $TARGET_DIR/docker ? (y/N) " CONF
    if [ "$CONF" = "y" ] || [ "$CONF" = "Y" ]; then
      echo "Creating symlink with sudo..." | tee -a "$OUTFILE"
      sudo ln -sf "$APP_BIN" "$TARGET_DIR/docker"
      # make executable and recreate docker-compose symlink if available
      if [ -e "$APP_BIN-compose" ]; then
        sudo ln -sf "$APP_BIN-compose" "$TARGET_DIR/docker-compose" || true
      fi
      echo "Symlink created. Hashing..." | tee -a "$OUTFILE"
      hash -r || true
      echo "After symlink, which docker:" | tee -a "$OUTFILE"
      which docker 2>/dev/null || echo "no-docker-found" | tee -a "$OUTFILE"
      docker --version 2>&1 || echo "no docker binary" | tee -a "$OUTFILE"
    else
      echo "Symlink creation skipped by user." | tee -a "$OUTFILE"
    fi
  fi
else
  echo "No embedded Docker Desktop binary found at common app paths." | tee -a "$OUTFILE"
  echo "If Docker Desktop is installed but not found, consider reinstalling via Homebrew: 'brew install --cask docker'." | tee -a "$OUTFILE"
fi

echo "" | tee -a "$OUTFILE"
echo "--- Final check: docker available now? ---" | tee -a "$OUTFILE"
if command -v docker >/dev/null 2>&1; then
  echo "docker now available at: $(command -v docker)" | tee -a "$OUTFILE"
  docker --version 2>&1 | tee -a "$OUTFILE"
  echo "docker compose version:" | tee -a "$OUTFILE"
  docker compose version 2>&1 | tee -a "$OUTFILE" || true

  # show containers
  echo "" | tee -a "$OUTFILE"
  echo "docker ps (short):" | tee -a "$OUTFILE"
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | tee -a "$OUTFILE" || true

  # attempt to call API in backend container via compose exec
  echo "" | tee -a "$OUTFILE"
  echo "Attempting to call learning-metrics inside backend container (via docker compose exec)..." | tee -a "$OUTFILE"
  set +e
  docker compose exec backend bash -lc "curl -s -S -H 'Accept: application/json' http://127.0.0.1:8080/api/dashboard/learning-metrics/ | jq . -C" > /tmp/diag_api_out.json 2>/tmp/diag_api_err.txt
  RC=$?
  set -e
  if [ $RC -eq 0 ]; then
    echo "API call successful; saved to /tmp/diag_api_out.json" | tee -a "$OUTFILE"
    cat /tmp/diag_api_out.json | sed -n '1,400p' | tee -a "$OUTFILE"
  else
    echo "API call failed (exit $RC). curl stderr:" | tee -a "$OUTFILE"
    sed -n '1,200p' /tmp/diag_api_err.txt | tee -a "$OUTFILE"
    echo "If backend container name isn't 'backend', adjust the docker compose service name or run the curl in the appropriate container." | tee -a "$OUTFILE"
  fi
else
  echo "docker still not available. Please start Docker Desktop or reinstall CLI." | tee -a "$OUTFILE"
fi

echo "=== finished. log saved to $OUTFILE ==="