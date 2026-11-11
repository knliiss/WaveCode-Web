import { useEffect, useState } from "react";
import { ArrowUpRight, AudioLines, CircleHelp, Github, ScanLine, ShieldCheck, X } from "lucide-react";
import { BrowserWaveCodeEngine } from "../infrastructure/wavecode/engine";
import { ScannerScreen } from "../features/scanner/ScannerScreen";
import { CreateScreen } from "../features/create/CreateScreen";

type Tab = "scan" | "create";

function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={"brand " + (small ? "brand-small" : "")}>
      <div className="brand-icon"><img src="./logo.svg" alt="" /></div>
      <div className="brand-word">wave<span>code</span><sup>®</sup></div>
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>("scan");
  const [engine, setEngine] = useState<BrowserWaveCodeEngine | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    const instance = new BrowserWaveCodeEngine();
    setEngine(instance);
    return () => instance.dispose();
  }, []);

  return (
    <div className="app-shell">
      <div className="app-wrapper">
        <header className="app-header">
          <Brand />
          <div className="header-right">
            <span className="header-v1">THE MUSIC MARK SYSTEM <span>— V1</span></span>
            <button className="header-info" type="button" aria-label="About WaveCode" onClick={() => setAboutOpen(true)}>
              <CircleHelp size={19} />
            </button>
          </div>
        </header>

        <div className="app-body">
          <main className="content-main">
            {engine
              ? tab === "scan"
                ? <ScannerScreen key="scanner" engine={engine} active />
                : <CreateScreen key="creator" engine={engine} />
              : <div className="boot-screen" role="status">Preparing WaveCode…</div>}
          </main>

          <aside className="editorial-panel" aria-label="About the WaveCode format">
            <div className="editorial-top"><span>ANOTHER WAY TO SHARE MUSIC.</span><span>EST. 2026</span></div>
            <div className="editorial-art" aria-hidden="true"><img src="./logo.svg" alt="" /></div>
            <div className="editorial-middle">
              <span className="editorial-overline">A LINK, REIMAGINED.</span>
              <h2>Keep the<br /><em>moment.</em></h2>
              <p>Music is more than a URL. It lives in the pause, the repeat, the exact second you want to remember.</p>
            </div>
            <div className="editorial-bottom">
              <div><span className="short-stroke" /> 36 OPTICAL COLUMNS</div>
              <div>ONE CONTINUOUS QUIET CHANNEL</div>
            </div>
          </aside>
        </div>

        <footer className="app-footer">
          <span><ShieldCheck size={14} /> All decoding happens on your device.</span>
          <div><a href="https://github.com/knliiss/WaveCode" target="_blank" rel="noopener noreferrer"><Github size={14} /> Open source <ArrowUpRight size={12} /></a><span className="footer-divider" /> <span>WAVECODE V1</span></div>
        </footer>
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <div className="nav-inner">
          <button type="button" className={tab === "scan" ? "nav-item active" : "nav-item"} aria-current={tab === "scan" ? "page" : undefined} onClick={() => setTab("scan")}>
            <ScanLine size={19} /> <span>Scan</span><span className="nav-index">01</span>
          </button>
          <span className="nav-separator" />
          <button type="button" className={tab === "create" ? "nav-item active" : "nav-item"} aria-current={tab === "create" ? "page" : undefined} onClick={() => setTab("create")}>
            <AudioLines size={19} /> <span>Create</span><span className="nav-index">02</span>
          </button>
        </div>
      </nav>

      {aboutOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAboutOpen(false)}>
          <section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="about-close" aria-label="Close about panel" onClick={() => setAboutOpen(false)}><X size={20} /></button>
            <Brand small />
            <h2 id="about-title">Music, in a mark.</h2>
            <p>WaveCode is an open optical format that encodes a track's identity and optional starting moment into 36 columns, divided by a quiet center channel.</p>
            <p>Scanning and generation use the original open-source Rust decoder compiled to WebAssembly. Your images stay on your device.</p>
            <a href="https://github.com/knliiss/WaveCode" target="_blank" rel="noopener noreferrer" className="about-link">Explore the format <ArrowUpRight size={17} /></a>
          </section>
        </div>
      )}
    </div>
  );
}
