import {
  ArrowDownToLine, ArrowRight, Check, ClipboardPaste, Clock3,
  Copy, Link2, LoaderCircle, MoveUpRight, ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { GeneratedWaveCode, WaveCodeEngine } from "../../domain/wavecode";
import { parseMoment, platformLabel, validateMusicLink } from "../../domain/music-url";
import { downloadBytes, downloadSvg } from "../../infrastructure/download";

interface Props { engine: WaveCodeEngine; }

const BLINDING_LIGHTS = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";

export function CreateScreen({ engine }: Props) {
  const [link, setLink] = useState("");
  const [moment, setMoment] = useState("");
  const [result, setResult] = useState<GeneratedWaveCode | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const jobRef = useRef(0);

  useEffect(() => {
    if (!result) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  const clearResult = () => {
    jobRef.current += 1;
    setResult(null);
    setCopied(false);
    setMessage("");
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalid = validateMusicLink(link);
    if (invalid) {
      setMessage(invalid);
      return;
    }
    let seconds: number | undefined;
    try {
      seconds = parseMoment(moment);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid timestamp.");
      return;
    }
    const job = ++jobRef.current;
    setPending(true);
    setMessage("");
    try {
      await engine.initialize();
      const generated = await engine.generate(link.trim(), seconds);
      if (job !== jobRef.current) return;
      setResult(generated);
      setMessage("Your WaveCode is ready. Save it as SVG or PNG.");
    } catch (error) {
      if (job !== jobRef.current) return;
      setResult(null);
      setMessage(error instanceof Error
        ? error.message
        : "Unable to encode this link. Make sure it points to a supported track.");
    } finally {
      if (job === jobRef.current) setPending(false);
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setLink(text.trim());
      clearResult();
    } catch {
      setMessage("Clipboard access isn't available. Paste the link manually.");
    }
  };

  const copyLink = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.canonicalUrl);
      setCopied(true);
    } catch {
      setMessage("Clipboard access was denied.");
    }
  };

  return (
    <section className="create-layout" aria-labelledby="create-heading">
      <div className="heading-block">
        <div className="eyebrow"><span className="eyebrow-line" /> THE GENERATOR <span className="tiny-index">/ 02</span></div>
        <h1 id="create-heading">Make it <span>yours.</span></h1>
        <p>Turn any supported music link into a physical, shareable code.</p>
      </div>

      <div className="creator-panel">
        <div className="panel-index">
          <span>01 — YOUR MUSIC</span><span className="panel-index-dot" />
        </div>
        <form className="creator-form" onSubmit={(event) => void generate(event)} noValidate>
          <label htmlFor="track-link">Track link</label>
          <div className="input-wrap">
            <Link2 size={19} aria-hidden="true" />
            <input
              id="track-link"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="Paste a music link…"
              spellCheck={false}
              value={link}
              onChange={(event) => { setLink(event.target.value); clearResult(); }}
            />
            <button type="button" className="input-paste" onClick={() => void paste()} aria-label="Paste link from clipboard" title="Paste from clipboard">
              <ClipboardPaste size={18} />
            </button>
          </div>
          <div className="form-hint">YouTube Music, Spotify, Apple Music + 4 more</div>

          <div className="moment-row">
            <div className="moment-description">
              <label htmlFor="track-moment">Start at a moment</label>
              <span>Optional · seconds or mm:ss</span>
            </div>
            <div className="moment-field">
              <Clock3 size={16} aria-hidden="true" />
              <input
                id="track-moment"
                type="text"
                inputMode="numeric"
                placeholder="00:00"
                value={moment}
                onChange={(event) => { setMoment(event.target.value); clearResult(); }}
                maxLength={8}
              />
            </div>
          </div>

          <button type="submit" className="create-submit" disabled={pending}>
            {pending ? <><LoaderCircle className="spin" size={19} /> Creating your code…</> : <>Create WaveCode <ArrowRight size={19} /></>}
          </button>
          <button type="button" className="example-link" onClick={() => { setLink(BLINDING_LIGHTS); setMoment(""); clearResult(); }}>
            Try an example <MoveUpRight size={14} /> <span>Blinding Lights — The Weeknd</span>
          </button>
        </form>
      </div>

      <div className={"output-panel " + (result ? "generated" : "")}>
        <div className="panel-index"><span>02 — THE RESULT</span><span>{result ? "READY TO SAVE" : "AWAITING INPUT"}</span></div>
        <div className="output-stage">
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="Generated 36-column WaveCode with capsule-shaped rails" />
              <div className="output-meta"><span>{platformLabel(result?.canonicalUrl ?? "")}</span><span>WAVECODE V1</span></div>
            </>
          ) : (
            <div className="output-empty">
              <div className="sample-lines" aria-hidden="true">
                {Array.from({ length: 15 }, (_, i) => (
                  <span key={i} style={{ "--i": i, "--up": 13 + Math.abs(7 - i) * 3, "--down": 16 + (i % 5) * 7 } as CSSProperties} />
                ))}
              </div>
              <span>Your sound, in 36 columns.</span>
            </div>
          )}
        </div>
        {result ? (
          <div className="export-actions">
            <button type="button" className="export-primary" onClick={() => downloadSvg(result.svg, "wavecode.svg")}>
              <ArrowDownToLine size={17} /> Save SVG
            </button>
            <button type="button" onClick={() => downloadBytes(result.png, "wavecode.png", "image/png")}>
              <ArrowDownToLine size={17} /> PNG
            </button>
            <button type="button" aria-label="Copy encoded music link" onClick={() => void copyLink()}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        ) : (
          <div className="output-footnote"><ShieldCheck size={15} /> Built with the original Rust WaveCode engine</div>
        )}
      </div>

      {message && <div className={"form-message " + (result ? "form-success" : "")} role="status">{message}</div>}
    </section>
  );
}
