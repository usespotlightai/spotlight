#!/bin/sh
# Spotlight runner installer.
set -eu

REPO="${SPOTLIGHT_REPO:-usespotlightai/cli}"
VERSION="${SPOTLIGHT_VERSION:-latest}"
API_BASE="${SPOTLIGHT_URL:-__API_BASE__}"

if [ "$VERSION" = "latest" ]; then
  RELEASE="https://github.com/$REPO/releases/latest/download"
else
  RELEASE="https://github.com/$REPO/releases/download/$VERSION"
fi

BINARIES="runner spotlight"

say() { printf 'spotlight: %s\n' "$1" >&2; }
die() { printf 'spotlight: %s\n' "$1" >&2; exit 1; }

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
  die "need curl or wget to download the binaries"
fi

if command -v sha256sum >/dev/null 2>&1; then
  checksum() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  checksum() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  checksum() { echo ""; }
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

install_binary() {
  name="$1"
  url="$RELEASE/${name}-${PLATFORM}"

  say "downloading $name ($PLATFORM)"
  fetch "$url" "$TMP/$name" || die "could not download $name from $url"

  want="$(fetch "$url.sha256" "$TMP/$name.sha256" 2>/dev/null && cut -d' ' -f1 <"$TMP/$name.sha256" || echo "")"
  got="$(checksum "$TMP/$name")"
  if [ -n "$want" ] && [ -n "$got" ] && [ "$want" != "$got" ]; then
    die "$name failed checksum: expected $want, got $got"
  fi

  chmod +x "$TMP/$name"
  install "$TMP/$name" "$BIN_DIR/$name" 2>/dev/null || mv "$TMP/$name" "$BIN_DIR/$name"
  say "installed $BIN_DIR/$name"
}

config_path() {
  if [ -n "${SPOTLIGHT_CONFIG:-}" ]; then
    echo "$SPOTLIGHT_CONFIG"
  elif [ "$(id -u)" = "0" ]; then
    echo "/etc/spotlight/runner.env"
  else
    echo "$HOME/.spotlight/runner.env"
  fi
}

save_url() {
  cfg="$(config_path)"
  mkdir -p "$(dirname "$cfg")"
  token=""
  [ -f "$cfg" ] && token="$(sed -n 's/^SPOTLIGHT_TOKEN=//p' "$cfg" | head -1)"
  umask 077
  {
    echo "SPOTLIGHT_URL=$API_BASE"
    [ -n "$token" ] && echo "SPOTLIGHT_TOKEN=$token"
  } >"$cfg"
}

main() {
  detect_platform
  choose_bindir

  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  for name in $BINARIES; do
    install_binary "$name"
  done

  save_url

  case ":$PATH:" in
    *":$BIN_DIR:"*) runner="runner" ;;
    *)
      runner="$BIN_DIR/runner"
      say "add $BIN_DIR to your PATH: export PATH=\"$BIN_DIR:\$PATH\""
      ;;
  esac

  say "installed. Enrol a runner in Spotlight for a token, then connect this host:"
  printf '\n  %s register\n\n' "$runner" >&2
}

main
