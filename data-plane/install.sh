#!/bin/sh
set -eu

REPO="${SPOTLIGHT_REPO:-usespotlightai/cli}"
VERSION="${SPOTLIGHT_VERSION:-__VERSION__}"
API_BASE="${SPOTLIGHT_URL:-__API_BASE__}"
IMAGE="${SPOTLIGHT_RUNNER_IMAGE:-ghcr.io/usespotlightai/spotlight-runner:$VERSION}"

if [ -n "${SPOTLIGHT_DOWNLOAD_URL:-}" ]; then
  RELEASE="$SPOTLIGHT_DOWNLOAD_URL"
elif [ "$VERSION" = "latest" ]; then
  RELEASE="https://github.com/$REPO/releases/latest/download"
else
  RELEASE="https://github.com/$REPO/releases/download/$VERSION"
fi

say() { printf 'spotlight host: %s\n' "$1" >&2; }
die() { printf 'spotlight host: %s\n' "$1" >&2; exit 1; }

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

  say "downloading spotlight $VERSION ($PLATFORM)"
  fetch "$url" "$TMP/spotlight" || die "could not download spotlight from $url"
  fetch "$url.sha256" "$TMP/spotlight.sha256" || die "could not download the checksum from $url.sha256"

  want="$(cut -d' ' -f1 <"$TMP/spotlight.sha256")"
  got="$(checksum "$TMP/spotlight")"
  [ "$want" = "$got" ] || die "spotlight failed its checksum: expected $want, got $got"

  chmod +x "$TMP/spotlight"
  mv "$TMP/spotlight" "$BIN_DIR/spotlight"
  say "installed $BIN_DIR/spotlight"
}

held() { [ -f "$CONFIG" ] && sed -n "s/^$1=//p" "$CONFIG" | head -1 || true; }

read_credentials() {
  token="${SPOTLIGHT_TOKEN:-$(held SPOTLIGHT_TOKEN)}"
  trust="${SPOTLIGHT_TRUST:-$(held SPOTLIGHT_TRUST)}"
  token_file="${SPOTLIGHT_OIDC_TOKEN_FILE:-$(held SPOTLIGHT_OIDC_TOKEN_FILE)}"
  capacity="${SPOTLIGHT_CAPACITY:-$(held SPOTLIGHT_CAPACITY)}"

  if [ -z "$token" ] && [ -z "$trust" ]; then
    die "set SPOTLIGHT_TOKEN to a pull pool's token, or SPOTLIGHT_TRUST and SPOTLIGHT_OIDC_TOKEN_FILE to claim through a runner trust"
  fi
}

save_config() {
  mkdir -p "$(dirname "$CONFIG")"
  (
    umask 077
    {
      echo "SPOTLIGHT_URL=$API_BASE"
      [ -n "$token" ] && echo "SPOTLIGHT_TOKEN=$token"
      [ -n "$trust" ] && echo "SPOTLIGHT_TRUST=$trust"
      [ -n "$token_file" ] && echo "SPOTLIGHT_OIDC_TOKEN_FILE=$token_file"
      [ -n "$capacity" ] && echo "SPOTLIGHT_CAPACITY=$capacity"
      echo "SPOTLIGHT_RUNNER_IMAGE=$IMAGE"
    } >"$CONFIG"
  )
  chmod 600 "$CONFIG"
  say "wrote $CONFIG"
}

pull_image() {
  say "pulling $IMAGE"
  "$RUNTIME" pull --quiet "$IMAGE" >/dev/null || die "could not pull $IMAGE"
}

main() {
  detect_platform
  choose_bindir
  CONFIG="$(config_path)"
  read_credentials
  find_runtime

  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  install_binary
  save_config
  pull_image

  if [ "${SPOTLIGHT_NO_SERVICE:-}" = "1" ]; then
    say "installed. Start it with: SPOTLIGHT_HOST_CONFIG=$CONFIG $BIN_DIR/spotlight host"
    return
  fi

  SPOTLIGHT_HOST_CONFIG="$CONFIG" "$BIN_DIR/spotlight" host install
  say "serving $API_BASE: this machine shows on the workspace's Runners page once it reports"
}

main
