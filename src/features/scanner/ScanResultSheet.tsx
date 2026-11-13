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
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const code = codes[selection];
  if (!code) return null;
  const urls = code.urls?.length ? code.urls : [code.url];
  if (!urls.length || !urls.every(isSupportedMusicUrl)) return null;
  const url = urls[0]!;
  const video = isVideoUrl(url);
  const dual = urls.length > 1;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="result-sheet" role="dialog" aria-modal="false" aria-labelledby="result-title">
      <div className="sheet-grabber" aria-hidden="true" />
      <div className="result-topline">
        <span className="result-ok">{dual ? "DUAL CODE FOUND" : "CODE FOUND"}</span>
        <button className="sheet-dismiss" type="button" onClick={onDismiss} aria-label="Close result"><X size={19} /></button>
      </div>
      <h2 id="result-title">There's your<br /><em>{dual ? "two links." : video ? "video." : "music."}</em></h2>

      {codes.length > 1 && (
        <div className="result-choices" role="group" aria-label="Choose detected WaveCode">
          {codes.map((item, index) => (
            <button
              key={index}
              type="button"
              className={selection === index ? "active" : ""}
              onClick={() => { setSelection(index); setCopied(null); }}
            >
              {index + 1}. {item.urls?.length === 2 ? "Dual" : platformLabel(item.url)}
            </button>
          ))}
        </div>
      )}

      {dual ? (
        <div className="dual-results">
          {urls.map((link) => (
            <div className="dual-result" key={link}>
              <div className="result-track">
                <span className="track-monogram"><span className="brand-symbol" aria-hidden="true" /></span>
                <div className="result-track-text">
                  <strong>{platformLabel(link)}</strong>
                  <span>{musicIdentity(link)}</span>
                </div>
              </div>
              <div className="result-buttons">
                <a className="result-open" href={link} target="_blank" rel="noopener noreferrer">
                  Open {platformLabel(link)}
                </a>
                <button
                  type="button"
                  className="result-copy"
                  aria-label={copied === link ? "Link copied" : `Copy ${platformLabel(link)} link`}
                  onClick={() => void copy(link)}
                >
                  {copied === link ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="result-track">
            <span className="track-monogram"><span className="brand-symbol" aria-hidden="true" /></span>
            <div className="result-track-text">
              <strong>{platformLabel(url)}</strong>
              <span>{musicIdentity(url)}</span>
            </div>
          </div>
          <div className="result-buttons">
            <a className="result-open" href={url} target="_blank" rel="noopener noreferrer">
              {video ? "Open video" : "Open track"}
            </a>
            <button
              type="button"
              className="result-copy"
              onClick={() => void copy(url)}
              aria-label={copied === url ? "Link copied" : video ? "Copy video link" : "Copy track link"}
            >
              {copied === url ? "Copied" : "Copy link"}
            </button>
          </div>
        </>
      )}
      <button type="button" className="result-again" onClick={onScanAgain}>Scan another code</button>
    </div>
  );
}
