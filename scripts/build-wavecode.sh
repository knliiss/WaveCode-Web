#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/.cache/wavecode"
TARGET="$ROOT/src/generated/wavecode"
WAVECODE_COMMIT="310c6d7c9e3d78a2c0ac1bb7c6c249edb3c22897"

command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
command -v cargo >/dev/null || { echo "Rust is required: https://rustup.rs" >&2; exit 1; }
command -v wasm-pack >/dev/null || { echo "Install wasm-pack: cargo install wasm-pack --locked" >&2; exit 1; }

if [[ ! -d "$SOURCE/.git" ]]; then
  mkdir -p "$ROOT/.cache"
  git clone --no-checkout https://github.com/knliiss/WaveCode.git "$SOURCE"
fi

git -C "$SOURCE" fetch --depth 1 origin "$WAVECODE_COMMIT"
git -C "$SOURCE" checkout --detach "$WAVECODE_COMMIT"

mkdir -p "$TARGET"
wasm-pack build "$SOURCE/crates/wavecode-wasm" \
  --target web --release --out-dir "$TARGET" --out-name wavecode_wasm

echo "WaveCode WASM ready (pinned to $WAVECODE_COMMIT)."
