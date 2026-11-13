import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BrowserWaveCodeEngine } from "../infrastructure/wavecode/engine";
import { ScannerScreen } from "../features/scanner/ScannerScreen";
import { CreateScreen } from "../features/create/CreateScreen";

type Tab = "scan" | "create";

function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={"brand " + (small ? "brand-small" : "")}>
      <div className="brand-icon"><span className="brand-symbol" aria-hidden="true" /></div>
      <div className="brand-word">wave<span>code</span></div>
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
          <button className="header-info" type="button" aria-label="About WaveCode" onClick={() => setAboutOpen(true)}>
            About
          </button>
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
            <div className="editorial-art" aria-hidden="true"><span className="brand-symbol" /></div>
            <div className="editorial-middle">
              <h2>Keep the<br /><em>moment.</em></h2>
            </div>
          </aside>
        </div>

        <footer className="app-footer">
          <span>Private, on-device processing</span>
          <a href="https://github.com/knliiss/WaveCode" target="_blank" rel="noopener noreferrer">Source on GitHub</a>
        </footer>
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <div className="nav-inner">
          <button type="button" className={tab === "scan" ? "nav-item active" : "nav-item"} aria-current={tab === "scan" ? "page" : undefined} onClick={() => setTab("scan")}>Scan</button>
          <button type="button" className={tab === "create" ? "nav-item active" : "nav-item"} aria-current={tab === "create" ? "page" : undefined} onClick={() => setTab("create")}>Create</button>
        </div>
      </nav>

      {aboutOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAboutOpen(false)}>
          <section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="about-close" aria-label="Close about panel" onClick={() => setAboutOpen(false)}><X size={20} /></button>
            <Brand small />
            <h2 id="about-title">Media, in a mark.</h2>
            <p>WaveCode supports the original 36-column V1 format and V2 with a W-shaped locator, variable-length payload, independent visual proportions and two-link Dual codes. Moments remain native platform links.</p>
            <p>Scanning and generation use the original open-source Rust decoder compiled to WebAssembly. Your images stay on your device.</p>
            <a href="https://github.com/knliiss/WaveCode" target="_blank" rel="noopener noreferrer" className="about-link">Explore the format</a>
          </section>
        </div>
      )}
    </div>
  );
}
