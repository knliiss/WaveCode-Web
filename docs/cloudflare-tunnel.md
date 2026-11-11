# WaveCode Web — separate Cloudflare Tunnel

Public hostname: `https://wawecode.knalis.rest` (spelling is intentional).

The WaveCode Web tunnel is separate from any existing Cloudflare Tunnels.
The app listens only on `127.0.0.1:4173`, and Cloudflare provides HTTPS.
Camera access on mobile browsers requires HTTPS.

## Requirements

- `knalis.rest` must be an active DNS zone in the Cloudflare account.
- Install `cloudflared` (on macOS: `brew install cloudflared`).
- Install Node.js 22+, Rust with `wasm32-unknown-unknown`, and `wasm-pack`.
- Authenticate once with `cloudflared tunnel login` if not already authenticated.

## First launch

```bash
npm install
npm run sdk:build
npm run build
npm run tunnel:setup
```

`npm run tunnel:setup` creates a separate locally-managed tunnel named
`wavecode-web` only if one does not already exist, writes
`~/.cloudflared/wawecode.yml`, validates the ingress rules, and creates
the Cloudflare DNS route. If a DNS record for the hostname already exists,
the script fails rather than overwriting it.

The credential JSON file is generated locally by cloudflared. Never commit
`~/.cloudflared`, the tunnel JSON credentials or `cert.pem`.

## Run (two terminals)

Terminal 1:

```bash
npm run preview
```

Terminal 2:

```bash
npm run tunnel:run
```

Then open `https://wawecode.knalis.rest`.

To diagnose:

```bash
curl -I http://127.0.0.1:4173
cloudflared tunnel info wavecode-web
cloudflared tunnel --config "$HOME/.cloudflared/wawecode.yml" ingress validate
curl -I https://wawecode.knalis.rest
```

Keep both processes running. The tunnel only works while the machine, local
HTTP origin, and cloudflared connector are running. The Vite preview server
is suitable for smoke testing; for a long-running public deployment, use a
dedicated static HTTP server or deploy the static `dist/` files to Cloudflare
Pages instead.

The Vite allowlist deliberately contains only the WaveCode hostname, rather
than turning off Vite host checks with `allowedHosts: true`.
