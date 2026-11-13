<p align="center">
  <img src="public/logo.svg" width="128" alt="WaveCode W logo">
</p>
<h1 align="center">WaveCode Web</h1>
<p align="center"><strong>Media, in a mark.</strong><br>Scan and create open optical codes for music, videos and moments.</p>
<p align="center">
  <a href="https://github.com/knliiss/WaveCode">Format & Rust SDK</a> ·
  <a href="https://github.com/knliiss/WaveCode-Web/actions/workflows/ci.yml">Build checks</a> ·
  <a href="LICENSE">MIT license</a>
</p>

WaveCode Web is a **mobile-first scanner and creator** for both [WaveCode V1 and V2](https://github.com/knliiss/WaveCode). The interface is intentionally monochrome, touch-friendly and responsive to camera orientation, safe areas and screen size.

All processing is performed **on your device**, using the upstream Rust codec compiled to WebAssembly inside a Web Worker. The frontend does not upload media, resolve song identities on a server, host a music player, or require an account.

## What you can do

| Feature | What it does |
| --- | --- |
| Live scanner | Finds supported WaveCode marks using the device camera; prefers the rear lens |
| Photo import | Scans local PNG/JPEG and device photos with progressively detailed crops |
| V1 creation | Generates the original fixed 36-column WaveCode |
| V2 Single | Generates a W-anchored variable-length optical code for one supported media link |
| V2 Dual | Encodes **two independent** Spotify and YouTube Music destinations, with an optional shared moment |
| Proportions | Independently controls W size, payload height, middle gap and W-to-payload gap for V2 |
| Export | Copies or saves the generated SVG or PNG |
| Scan results | Opens original platform links with small, round provider badges; Dual exposes both destinations separately |

The scanner accepts V1 and V2 in the same interface. **V1 remains the default creation mode** for backward-compatible output; V2 Single and Dual are available from the Create format selector. Scanning results and generated destinations display locally bundled provider badges; no third-party icon network requests are made.

## Create a V2 code

1. Open **Create**, then choose **V2 · single** or **V2 · dual**.
2. Paste one supported media link or, for Dual, a Spotify track URL and a YouTube Music watch URL.
3. Optionally set a native start moment (`mm:ss` or seconds) where supported.
4. Open **Adjust proportions** to change W reference height, payload reference height, middle whitespace or W-to-payload spacing.
5. Select **Create WaveCode** to preview and save/copy the code.

### Independently sized W and data

V2's W is a real **22-capsule optical anchor** encoding the BCH-protected version. It is always on the logical left and determines the mark's orientation. It is **not** a size reference for the payload, and it does not encode source, time or visual style.

Payload heights come from the payload's own 16-level dual-rail alphabet. The scanner derives their scale independently. Neither the distance between the W and payload nor the center-gap width carries data. This freedom still requires visible, separated capsules; excessively small printed bars or merged shapes can defeat optical recognition.

Dual codes contain both original IDs losslessly. WaveCode never guesses that two platform URLs represent the same song, and it does not require a proprietary track-pair database.

## Supported links

YouTube Music, YouTube videos and Shorts, Spotify, Apple Music, Deezer, TIDAL, Qobuz, Amazon Music, TikTok (numeric video IDs and `vt.tiktok.com` short share codes) and Instagram Reels.

YouTube and supported music services can retain a native starting moment. TikTok and Instagram do not encode moments. TikTok short links are stored as their own exact identities; they may stop resolving if TikTok retires a redirect. Media is always opened on its original platform, not in a WaveCode-hosted player.

## Architecture

```text
src/
  app/                   Shell, navigation and brand
  domain/                Versioned code types and URL validation
  features/
    create/              V1/V2 creation, proportions, export
    scanner/             Camera state, photo scanning, scan results
  infrastructure/
    wavecode/            Typed Worker client + Rust WASM adapter
    camera/              Capture, exposure and crop strategies
    clipboard.ts         Local PNG clipboard
    download.ts          Local SVG/PNG export
  generated/wavecode/    Compiled WASM output (gitignored)
tests/                   Domain and camera-policy tests
e2e/                     Mobile Chromium and WebKit browser checks
scripts/                 Pinned SDK and deployment builds
```

WaveCode Web never reimplements the payload, CRC, Reed–Solomon or BCH codecs in TypeScript. The Rust [WaveCode SDK](https://github.com/knliiss/WaveCode) is the single source of truth for both format versions.

Heavy work and decoded image bytes are isolated from React through Worker messages. UI state manages camera permissions, cancellation, actions and result display. The scanner accepts only HTTPS URLs with supported platform hosts before showing a link.

## Local development

Requirements: Node.js **22+**, npm, Git, Rust with the `wasm32-unknown-unknown` target, and `wasm-pack`.

```bash
git clone https://github.com/knliiss/WaveCode-Web.git
cd WaveCode-Web

rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked

npm install
npm run sdk:build
npm run dev
```

The SDK builder checks out a **pinned Rust commit** into `.cache/wavecode` and compiles browser bindings into `src/generated/wavecode`. Generated assets are excluded from Git; the build remains reproducible from source.

### Checks

```bash
npm run sdk:build
npm run typecheck
npm test
npm run build

npx playwright install chromium webkit
npm run test:e2e
```

CI runs TypeScript, unit tests, a production build and mobile browser end-to-end round trips for V1/V2. The V2 Dual test generates a PNG with a W smaller than its payload, scans it and verifies both returned platform links.

## Deployment

The site is a **static Vite build**. Deploy `dist/` to Cloudflare Pages or another HTTPS static host. In clean build environments, compile the pinned Rust SDK **before** running the web build:

```bash
npm install
npm run sdk:build
npm run build
```

For deployment through Cloudflare's Git integration, follow the [Cloudflare Pages guide](docs/cloudflare-pages.md) and use `bash scripts/build-cloudflare-pages.sh`. No backend or database is needed.

**Camera access requires HTTPS or localhost** on mobile browsers. Camera capabilities, torch and exposure vary across devices; file upload remains available if permission is denied.

## Reliability, privacy and security

The renderer produces deterministic optically valid marks for supported inputs; no scanner can guarantee every physical sample is readable. Very small bars, low resolution, glare, printing defects, dense backgrounds, extreme perspective and motion blur can defeat recognition. Test finished print or 3D pieces with target cameras before mass production.

Code generation and scanning execute locally. The app includes no account system, analytics SDK, remote scanner service or metadata lookup database. Result URLs are checked against HTTPS and an explicit supported-host allowlist before being exposed as navigation targets.

## License

WaveCode Web is MIT-licensed. The Rust SDK and the original WaveCode mark are maintained in [WaveCode](https://github.com/knliiss/WaveCode) under its own MIT license. Locally bundled provider glyphs are from [Simple Icons](https://simpleicons.org/) (CC0), [SVG Repo](https://www.svgrepo.com/svg/504778/qobuz) (CC0) and [custom-brand-icons](https://github.com/elax46/custom-brand-icons) (MIT, Amazon Music). Service names and trademarks belong to their respective owners.
