#!/bin/sh
set -eu

REPO="${SPOTLIGHT_REPO:-usespotlightai/spotlight}"
VERSION="${SPOTLIGHT_VERSION:-__VERSION__}"
API_BASE="${SPOTLIGHT_URL:-__API_BASE__}"
BASE_IMAGE="ghcr.io/usespotlightai/spotlight-runner"

if [ -n "${SPOTLIGHT_DOWNLOAD_URL:-}" ]; then
  RELEASE="$SPOTLIGHT_DOWNLOAD_URL"
elif [ "$VERSION" = "latest" ]; then
  RELEASE="https://github.com/$REPO/releases/latest/download"
elif printf '%s' "$VERSION" | grep -qE '^[0-9a-f]{12}$'; then
  RELEASE="https://github.com/$REPO/releases/download/canary"
else
  RELEASE="https://github.com/$REPO/releases/download/$VERSION"
fi

if [ -t 2 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD="$(printf '\033[1m')" GREEN="$(printf '\033[32m')" YELLOW="$(printf '\033[33m')" RED="$(printf '\033[31m')" RESET="$(printf '\033[0m')"
else
  BOLD="" GREEN="" YELLOW="" RED="" RESET=""
fi

say() { printf '%s\n' "$1" >&2; }
done_step() { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1" >&2; }
die() { printf '\n%sSorry, the install stopped:%s %s\n' "$RED$BOLD" "$RESET" "$1" >&2; exit 1; }

NEXT=""
next_step() { NEXT="$NEXT$1
"; }

print_next_steps() {
  [ -n "$NEXT" ] || return 0
  printf '\n%sNext steps%s\n' "$BOLD$YELLOW" "$RESET" >&2
  n=0
  printf '%s' "$NEXT" | while IFS= read -r line; do
    case "$line" in
      "  "*) printf '     %s\n' "${line#  }" >&2 ;;
      *) n=$((n + 1)); printf '\n  %s%d.%s %s\n' "$BOLD" "$n" "$RESET" "$line" >&2 ;;
    esac
  done
}

detect_platform() {
  os="$(uname -s)"
  case "$os" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *) die "unsupported operating system: $os" ;;
  esac

  arch="$(uname -m)"
  case "$arch" in
    x86_64 | amd64) arch="amd64" ;;
    aarch64 | arm64) arch="arm64" ;;
    *) die "unsupported architecture: $arch" ;;
  esac

  PLATFORM="${os}-${arch}"
}

if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -qO "$2" "$1"; }
else
  die "need curl or wget to download spotlight"
fi

if command -v sha256sum >/dev/null 2>&1; then
  checksum() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  checksum() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  die "need sha256sum or shasum to check what it downloads"
fi

choose_bindir() {
  if [ -n "${SPOTLIGHT_BIN_DIR:-}" ]; then
    BIN_DIR="$SPOTLIGHT_BIN_DIR"
  elif [ "$(id -u)" = "0" ] || [ -w /usr/local/bin ]; then
    BIN_DIR="/usr/local/bin"
  else
    BIN_DIR="$HOME/.spotlight/bin"
  fi
  mkdir -p "$BIN_DIR"
}

config_path() {
  if [ -n "${SPOTLIGHT_HOST_CONFIG:-}" ]; then
    echo "$SPOTLIGHT_HOST_CONFIG"
  elif [ "$(id -u)" = "0" ]; then
    echo "/etc/spotlight/host.env"
  else
    echo "$HOME/.spotlight/host.env"
  fi
}

find_runtime() {
  for cli in docker podman; do
    if command -v "$cli" >/dev/null 2>&1 && "$cli" info >/dev/null 2>&1; then
      RUNTIME="$cli"
      return
    fi
  done
  die "no container runtime answered: install and start Docker or Podman (on macOS, Docker Desktop, OrbStack or Colima), then run this again"
}

install_binary() {
  url="$RELEASE/spotlight-${PLATFORM}"

  fetch "$url" "$TMP/spotlight" || die "could not download spotlight from $url"
  fetch "$url.sha256" "$TMP/spotlight.sha256" || die "could not download the checksum from $url.sha256"

  want="$(cut -d' ' -f1 <"$TMP/spotlight.sha256")"
  got="$(checksum "$TMP/spotlight")"
  [ "$want" = "$got" ] || die "spotlight failed its checksum: expected $want, got $got"

  chmod +x "$TMP/spotlight"
  mv "$TMP/spotlight" "$BIN_DIR/spotlight"
  done_step "Installed $BIN_DIR/spotlight"
}

saved() { [ -f "$CONFIG" ] && sed -n "s/^$1=//p" "$CONFIG" | head -1 || true; }

read_credentials() {
  token="${SPOTLIGHT_POOL_TOKEN:-$(saved SPOTLIGHT_POOL_TOKEN)}"
  trust="${SPOTLIGHT_TRUST:-$(saved SPOTLIGHT_TRUST)}"
  token_file="${SPOTLIGHT_OIDC_TOKEN_FILE:-$(saved SPOTLIGHT_OIDC_TOKEN_FILE)}"
  capacity="${SPOTLIGHT_CAPACITY:-$(saved SPOTLIGHT_CAPACITY)}"
  IMAGE="${SPOTLIGHT_RUNNER_IMAGE:-}"
  if [ -z "$IMAGE" ]; then
    IMAGE="$(saved SPOTLIGHT_RUNNER_IMAGE)"
    case "$IMAGE" in
      "" | "$BASE_IMAGE":*) IMAGE="$BASE_IMAGE:$VERSION" ;;
    esac
  fi

  if [ -z "$token" ] && [ -z "$trust" ]; then
    die "set SPOTLIGHT_POOL_TOKEN to a pull pool's token, or SPOTLIGHT_TRUST and SPOTLIGHT_OIDC_TOKEN_FILE to claim through a runner trust"
  fi
}

save_config() {
  mkdir -p "$(dirname "$CONFIG")"
  (
    umask 077
    {
      echo "SPOTLIGHT_URL=$API_BASE"
      [ -n "$token" ] && echo "SPOTLIGHT_POOL_TOKEN=$token"
      [ -n "$trust" ] && echo "SPOTLIGHT_TRUST=$trust"
      [ -n "$token_file" ] && echo "SPOTLIGHT_OIDC_TOKEN_FILE=$token_file"
      [ -n "$capacity" ] && echo "SPOTLIGHT_CAPACITY=$capacity"
      echo "SPOTLIGHT_RUNNER_IMAGE=$IMAGE"
    } >"$CONFIG"
  )
  chmod 600 "$CONFIG"
  done_step "Wrote $CONFIG"
}

pull_image() {
  first="${IMAGE%%,*}"
  case "$first" in
    *"*"*) return 0 ;;
  esac
  "$RUNTIME" pull --quiet "$first" >/dev/null || die "could not pull $first"
  done_step "Pulled $first"
}

note_harnesses() {
  [ "$IMAGE" = "$BASE_IMAGE:$VERSION" ] || return 0
  next_step "Install a harness. The runner image holds none, so this host runs checks but no agent run."
  next_step "  Build an image FROM it with Claude Code, Codex, Cursor or OpenCode, as in:"
  next_step "  https://github.com/usespotlightai/spotlight/tree/main/.docker/runner/examples"
  next_step "  Then set SPOTLIGHT_RUNNER_IMAGE in $CONFIG and restart the host."
}

note_path() {
  case ":$PATH:" in
    *":$BIN_DIR:"*) return 0 ;;
  esac
  next_step "Add spotlight to your PATH. Put this line in your shell profile:"
  next_step "  export PATH=\"$BIN_DIR:\$PATH\""
}

note_linger() {
  [ "$(uname -s)" = "Linux" ] && [ "$(id -u)" != "0" ] || return 0
  [ "$(loginctl show-user "$(id -un)" --property=Linger --value 2>/dev/null)" = "yes" ] && return 0
  next_step "Keep the host running after you log out:"
  next_step "  loginctl enable-linger $(id -un)"
}

main() {
  detect_platform
  choose_bindir
  CONFIG="$(config_path)"
  read_credentials
  find_runtime

  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  say "${BOLD}Installing the Spotlight host $VERSION ($PLATFORM)${RESET}"
  say ""
  install_binary
  save_config
  pull_image

  if [ "${SPOTLIGHT_NO_SERVICE:-}" = "1" ]; then
    say ""
    say "${BOLD}${GREEN}Installed.${RESET} Start it with:"
    say "  SPOTLIGHT_HOST_CONFIG=$CONFIG $BIN_DIR/spotlight host"
  else
    SPOTLIGHT_HOST_CONFIG="$CONFIG" SPOTLIGHT_INSTALLER=1 "$BIN_DIR/spotlight" host install
    note_linger
    say ""
    say "${BOLD}${GREEN}The host serves $API_BASE.${RESET}"
    say "This machine shows on the workspace's Runners page when it reports."
  fi

  note_harnesses
  note_path
  print_next_steps
  say ""
}

main
