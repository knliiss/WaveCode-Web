#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This script is intended for the Cloudflare Pages Linux build environment." >&2
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "Installing Rust for the official WaveCode WASM SDK..."
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error     https://sh.rustup.rs -o /tmp/wavecode-rustup.sh
  sh /tmp/wavecode-rustup.sh -y --profile minimal --default-toolchain stable
fi

export PATH="$HOME/.cargo/bin:$PATH"
rustup target add wasm32-unknown-unknown

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "Installing wasm-pack..."
  cargo install wasm-pack --version 0.15.1 --locked
fi

npm install --no-audit --no-fund
npm run sdk:build
npm run build

test -s dist/index.html || {
  echo "Cloudflare Pages build did not produce dist/index.html" >&2
  exit 1
}
