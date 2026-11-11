import { ArrowRight, ArrowUpRight, Check, Copy, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LocatedWaveCode } from "../../domain/wavecode";
import { isSupportedMusicUrl, musicIdentity, platformLabel } from "../../domain/music-url";

interface Props {
  codes: LocatedWaveCode[];
  onDismiss(): void;
  onScanAgain(): void;
}

export function ScanResultSheet({ codes, onDismiss, onScanAgain }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [selection, setSelection] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    // Announce the decoded result to keyboard and screen-reader users.
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const code = codes[selection];
  if (!code || !isSupportedMusicUrl(code.url)) return null;
  const url = code.url;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="result-sheet" role="dialog" aria-modal="false" aria-labelledby="result-title">
      <div className="sheet-grabber" aria-hidden="true" />
      <div className="result-topline">
        <span className="result-ok"><Check size={15} strokeWidth={3} /> CODE FOUND</span>
        <button className="sheet-dismiss" type="button" onClick={onDismiss} aria-label="Close result"><X size={19} /></button>
      </div>
      <h2 id="result-title" tabIndex={-1} ref={headingRef}>There's your<br /><em>music.</em></h2>
      {codes.length > 1 && (
        <div className="result-choices" role="group" aria-label="Choose detected WaveCode">
          {codes.map((item, index) => (
            <button key={item.url} type="button" className={selection === index ? "active" : ""} onClick={() => { setSelection(index); setCopied(false); }}>
              {index + 1}. {platformLabel(item.url)}
            </button>
          ))}
        </div>
      )}
      <div className="result-track">
        <span className="track-monogram"><img src="./logo.svg" alt="" /></span>
        <div className="result-track-text">
          <strong>{platformLabel(url)}</strong>
          <span>{musicIdentity(url)}</span>
        </div>
        <ArrowUpRight size={19} />
      </div>
      <div className="result-buttons">
        <a className="result-open" href={url} target="_blank" rel="noopener noreferrer">
          Open track <ArrowRight size={19} />
        </a>
        <button type="button" className="result-copy" onClick={() => void copy()} aria-label={copied ? "Link copied" : "Copy track link"}>
          {copied ? <Check size={19} /> : <Copy size={19} />}
        </button>
      </div>
      <button type="button" className="result-again" onClick={onScanAgain}><RotateCcw size={14} /> Scan another code</button>
    </div>
  );
}
