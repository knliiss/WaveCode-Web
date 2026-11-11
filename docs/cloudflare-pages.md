# Cloudflare Pages deployment

**Production hostname:** `https://wawecode.knalis.rest`

**Repository:** `knliiss/WaveCode-Web`

**Deployment:** Cloudflare Pages Git integration; no persistent Mac, local
port, Cloudflare Tunnel or self-hosted service is necessary.

## Connect GitHub to Pages

1. Go to [Cloudflare Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. Select **Create** → **Pages** → **Connect to Git** (labels vary).
3. Connect GitHub and select `knliiss/WaveCode-Web`.
4. Project name: `wawecode-knalis` (choose another if unavailable).
5. Production branch: `main`.
6. Framework preset: **None** / **Custom**.
7. Build command: `bash scripts/build-cloudflare-pages.sh`.
8. Build output directory: `dist`.
9. Root directory: repository root.
10. Node version: `22` (declared in `.node-version`).

The build script installs the Rust toolchain and wasm-pack in Cloudflare's
Linux build environment, compiles the pinned WaveCode Rust SDK to WebAssembly,
and then builds the Vite frontend. No working Node/Rust installation on the
local Mac is required.

## Connect the hostname

After the first successful deployment:

1. Open the Pages project.
2. Go to **Custom domains** → **Set up a domain**.
3. Enter `wawecode.knalis.rest` and confirm.
4. Because `knalis.rest` uses Cloudflare DNS, confirm the offered CNAME
   record creation.

Do not create the DNS record alone: Pages must associate the domain first.
If a record already exists, inspect and remove only the conflicting
`wawecode` record after confirming what it serves.

HTTPS is managed by Cloudflare and enables camera access on phones. No API
tokens, server-side account or backend service is required by the frontend.

## Verify

1. Cloudflare Pages reports a successful `main` deployment.
2. `https://wawecode.knalis.rest` loads.
3. Scan works on a physical phone with camera permission.
4. Create can render and export a code.
5. Scan can recognize the exported PNG.

Free Pages builds have a time limit. Compiling Rust/WASM on a cold builder
can be slow; if that limit is exceeded, deploy the GitHub Actions-built
`dist/` to Pages instead, using Cloudflare API credentials stored securely
as GitHub Actions secrets.
