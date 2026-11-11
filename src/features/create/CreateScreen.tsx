import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GeneratedWaveCode, WaveCodeEngine } from "../../domain/wavecode";
import { parseMoment, validateMusicLink } from "../../domain/music-url";
import { copyPngImage } from "../../infrastructure/clipboard";
import { downloadBytes, downloadSvg } from "../../infrastructure/download";
import { WaveCodePreview } from "./WaveCodePreview";

interface Props { engine: WaveCodeEngine; }

type CopyState = "idle" | "copying" | "copied";

export function CreateScreen({ engine }: Props) {
  const [link, setLink] = useState("");
  const [moment, setMoment] = useState("");
  const [result, setResult] = useState<GeneratedWaveCode | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const jobRef = useRef(0);
  const copyResetRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copyResetRef.current), []);

  const clearResult = () => {
    jobRef.current += 1;
    window.clearTimeout(copyResetRef.current);
    setPending(false);
    setResult(null);
    setCopyState("idle");
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
      setCopyState("idle");
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

  const copyImage = async () => {
    if (!result || copyState === "copying") return;
    const job = jobRef.current;
    setCopyState("copying");
    setMessage("");
    try {
      await copyPngImage(result.png);
      if (job !== jobRef.current) return;
      window.clearTimeout(copyResetRef.current);
      setCopyState("copied");
      copyResetRef.current = window.setTimeout(() => setCopyState("idle"), 2400);
    } catch (error) {
      if (job !== jobRef.current) return;
      setCopyState("idle");
      setMessage(error instanceof Error ? error.message : "Unable to copy the image. Save the PNG instead.");
    }
  };

  return (
    <section className="create-layout" aria-labelledby="create-heading">
      <div className="heading-block">
        <h1 id="create-heading">Make it <span>yours.</span></h1>
      </div>

      <div className="creator-panel">
        <form className="creator-form" onSubmit={(event) => void generate(event)} noValidate>
          <label htmlFor="track-link">Track link</label>
          <div className="input-wrap">
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
            <button type="button" className="input-paste" onClick={() => void paste()} aria-label="Paste link from clipboard">
              Paste
            </button>
          </div>

          <div className="moment-row">
            <div className="moment-description">
              <label htmlFor="track-moment">Start at a moment</label>
              <span className="visually-hidden">Optional. Seconds or minutes and seconds.</span>
            </div>
            <div className="moment-field">
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
            {pending ? "Creating…" : "Create WaveCode"}
          </button>
        </form>
      </div>

      {result && (
        <div className="output-panel">
          <WaveCodePreview svg={result.svg} />
          <div className="export-actions">
            <button type="button" className="export-primary" onClick={() => downloadSvg(result.svg, "wavecode.svg")}>Save SVG</button>
            <button type="button" onClick={() => downloadBytes(result.png, "wavecode.png", "image/png")}>Save PNG</button>
            <button type="button" className="export-copy" disabled={copyState === "copying"} aria-label={copyState === "copied" ? "Image copied" : "Copy WaveCode image"} onClick={() => void copyImage()}>
              {copyState === "copied" ? "Copied" : copyState === "copying" ? "Copying…" : "Copy image"}
            </button>
          </div>
        </div>
      )}

      <span className="visually-hidden" role="status">{copyState === "copied" ? "WaveCode image copied to clipboard." : ""}</span>
      {message && <div className="form-message" role="alert">{message}</div>}
    </section>
  );
}
