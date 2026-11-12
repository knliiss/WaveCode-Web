import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { LocatedWaveCode } from "../../domain/wavecode";
import { isSupportedMusicUrl, isVideoUrl, musicIdentity, platformLabel } from "../../domain/music-url";

interface Props {
  codes: LocatedWaveCode[];
  onDismiss(): void;
  onScanAgain(): void;
}

export function ScanResultSheet({ codes, onDismiss, onScanAgain }: Props) {
  const [selection, setSelection] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const code = codes[selection];
  if (!code || !isSupportedMusicUrl(code.url)) return null;

  const url = code.url;
  const video = isVideoUrl(url);
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
        <span className="result-ok">CODE FOUND</span>
        <button className="sheet-dismiss" type="button" onClick={onDismiss} aria-label="Close result"><X size={19} /></button>
      </div>
      <h2 id="result-title">There's your<br /><em>{video ? "video." : "music."}</em></h2>
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
        <span className="track-monogram"><span className="brand-symbol" aria-hidden="true" /></span>
        <div className="result-track-text">
          <strong>{platformLabel(url)}</strong>
          <span>{musicIdentity(url)}</span>
        </div>
      </div>
      <div className="result-buttons">
        <a className="result-open" href={url} target="_blank" rel="noopener noreferrer">{video ? "Open video" : "Open track"}</a>
        <button type="button" className="result-copy" onClick={() => void copy()} aria-label={copied ? "Link copied" : video ? "Copy video link" : "Copy track link"}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <button type="button" className="result-again" onClick={onScanAgain}>Scan another code</button>
    </div>
  );
}
