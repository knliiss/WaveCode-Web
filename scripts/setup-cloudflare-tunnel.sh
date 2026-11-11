#!/usr/bin/env bash
set -euo pipefail

TUNNEL_NAME="wavecode-web"
HOSTNAME="wawecode.knalis.rest"
LOCAL_ORIGIN="http://127.0.0.1:4173"
CONFIG_DIRECTORY="$HOME/.cloudflared"
CONFIG_PATH="$CONFIG_DIRECTORY/wawecode.yml"

for binary in cloudflared python3; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "Missing $binary. Install cloudflared with Homebrew, and ensure Python 3 is available." >&2
    exit 1
  fi
done

mkdir -p "$CONFIG_DIRECTORY"

if ! listing="$(cloudflared tunnel list --output json)"; then
  echo "Cloudflare authentication is required. Run 'cloudflared tunnel login' and try again." >&2
  exit 1
fi

tunnel_id_from_listing() {
  python3 -c '
import json
import sys

tunnels = json.load(sys.stdin)
matching = [item for item in tunnels if item.get("name") == "wavecode-web"]
if len(matching) > 1:
    raise SystemExit("More than one tunnel named wavecode-web was found.")
print(matching[0]["id"] if matching else "")
'
}

tunnel_id="$(printf '%s' "$listing" | tunnel_id_from_listing)"

if [[ -z "$tunnel_id" ]]; then
  echo "Creating a separate Cloudflare Tunnel: $TUNNEL_NAME"
  cloudflared tunnel create "$TUNNEL_NAME"
  listing="$(cloudflared tunnel list --output json)"
  tunnel_id="$(printf '%s' "$listing" | tunnel_id_from_listing)"
fi

if [[ -z "$tunnel_id" ]]; then
  echo "Could not find the tunnel UUID after creation." >&2
  exit 1
fi

credentials_path="$CONFIG_DIRECTORY/$tunnel_id.json"
if [[ ! -f "$credentials_path" ]]; then
  echo "Missing local credentials: $credentials_path" >&2
  echo "This tunnel may have been created on a different computer. Do not overwrite other tunnel credentials." >&2
  exit 1
fi

if [[ -f "$CONFIG_PATH" ]]; then
  if ! grep -Fqx "tunnel: $tunnel_id" "$CONFIG_PATH" ||
     ! grep -Fq "hostname: $HOSTNAME" "$CONFIG_PATH" ||
     ! grep -Fq "service: $LOCAL_ORIGIN" "$CONFIG_PATH"; then
    echo "Refusing to overwrite existing tunnel configuration: $CONFIG_PATH" >&2
    exit 1
  fi
else
  cat > "$CONFIG_PATH" <<YAML
tunnel: $tunnel_id
credentials-file: $credentials_path

ingress:
  - hostname: $HOSTNAME
    service: $LOCAL_ORIGIN
  - service: http_status:404
YAML
  chmod 600 "$CONFIG_PATH"
fi

cloudflared tunnel --config "$CONFIG_PATH" ingress validate

echo "Creating Cloudflare DNS route for $HOSTNAME"
if ! cloudflared tunnel route dns "$tunnel_id" "$HOSTNAME"; then
  echo "DNS routing failed. Check whether the hostname already has an A, AAAA, or CNAME record in Cloudflare." >&2
  echo "The local tunnel configuration was preserved at $CONFIG_PATH." >&2
  exit 1
fi

echo
echo "Tunnel configured: $TUNNEL_NAME ($tunnel_id)"
echo "Hostname: https://$HOSTNAME"
echo "Local origin: $LOCAL_ORIGIN"
echo
echo "Run 'npm run preview' in one terminal, then 'npm run tunnel:run' in another."
