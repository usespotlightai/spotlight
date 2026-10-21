#!/bin/sh
set -eu

REPO="${SPOTLIGHT_REPO:-usespotlightai/spotlight}"
VERSION="${SPOTLIGHT_VERSION:-__VERSION__}"
API_BASE="__API_BASE__"

if [ -t 2 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD="$(printf '\033[1m')" GREEN="$(printf '\033[32m')" YELLOW="$(printf '\033[33m')" RED="$(printf '\033[31m')" RESET="$(printf '\033[0m')"
else
  BOLD="" GREEN="" YELLOW="" RED="" RESET=""
fi

say() { printf '%s\n' "$1" >&2; }
done_step() { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1" >&2; }
die() { printf '\n%sSorry, the install stopped:%s %s\n' "$RED$BOLD" "$RESET" "$1" >&2; exit 1; }

case "$VERSION" in
  latest) RELEASE="https://github.com/$REPO/releases/latest/download" ;;
  canary) RELEASE="https://github.com/$REPO/releases/download/canary" ;;
  v[0-9]*.[0-9]*.[0-9]*) RELEASE="https://github.com/$REPO/releases/download/$VERSION" ;;
  *) die "SPOTLIGHT_VERSION is $VERSION. Set it to latest, canary or a release, as in v0.1.0." ;;
esac
if [ -n "${SPOTLIGHT_DOWNLOAD_URL:-}" ]; then
  RELEASE="$SPOTLIGHT_DOWNLOAD_URL"
fi

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

note_path() {
  case ":$PATH:" in
    *":$BIN_DIR:"*) return 0 ;;
  esac
  next_step "Add spotlight to your PATH. Put this line in your shell profile:"
  next_step "  export PATH=\"$BIN_DIR:\$PATH\""
}

main() {
  detect_platform
  choose_bindir
  find_runtime

  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  say "${BOLD}Installing spotlight $VERSION ($PLATFORM)${RESET}"
  say ""
  install_binary
  say ""

  status=0
  "$BIN_DIR/spotlight" host init --url "$API_BASE" "$@" || status=$?

  note_path
  print_next_steps
  say ""
  exit "$status"
}

main "$@"
