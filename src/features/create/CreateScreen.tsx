import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GeneratedWaveCode, V2Geometry, WaveCodeEngine } from "../../domain/wavecode";
import {
  parseDualTrackIds, parseMoment, platformLabel, supportsNativeMoment, validateMusicLink,
} from "../../domain/music-url";
import { copyPngImage } from "../../infrastructure/clipboard";
import { downloadBytes, downloadSvg } from "../../infrastructure/download";
import { WaveCodePreview } from "./WaveCodePreview";

interface Props { engine: WaveCodeEngine; }
type CopyState = "idle" | "copying" | "copied";
type CreationMode = "v1" | "v2" | "dual";

export function CreateScreen({ engine }: Props) {
  const [mode, setMode] = useState<CreationMode>("v1");
  const [link, setLink] = useState("");
  const [secondLink, setSecondLink] = useState("");
  const [moment, setMoment] = useState("");
  const [payloadHeight, setPayloadHeight] = useState(210);
  const [logoHeight, setLogoHeight] = useState(210);
  const [centerGap, setCenterGap] = useState(14.5);
  const [blockGap, setBlockGap] = useState(25.2);
  const [result, setResult] = useState<GeneratedWaveCode | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const jobRef = useRef(0);
  const copyResetRef = useRef<number | undefined>(undefined);
  const hasNativeMoment = mode === "dual" || supportsNativeMoment(link);
  const geometry: V2Geometry = {
    payloadHeight,
    logoHeight,
    payloadCenterGap: centerGap,
    logoPayloadGap: blockGap,
  };

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
    const dualIds = mode === "dual" ? parseDualTrackIds(link, secondLink) : null;
    if (mode === "dual" && !dualIds) {
      setMessage("Dual needs a Spotify track URL and an independent YouTube Music watch URL.");
      return;
    }
    if (mode !== "dual") {
      const invalid = validateMusicLink(link);
      if (invalid) {
        setMessage(invalid);
        return;
      }
    }

    let seconds: number | undefined;
    try {
      if (!hasNativeMoment && moment.trim()) {
        throw new Error("This platform cannot open videos at a specific moment.");
      }
      seconds = hasNativeMoment ? parseMoment(moment) : undefined;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid timestamp.");
      return;
    }

    const job = ++jobRef.current;
    setPending(true);
    setMessage("");
    try {
      await engine.initialize();
      const generated = dualIds
        ? await engine.generateDual(
          dualIds.spotifyId, dualIds.youtubeMusicId, seconds, geometry,
        )
        : await engine.generate(link.trim(), seconds, mode === "v2" ? 2 : 1, geometry);
      if (job !== jobRef.current) return;
      setResult(generated);
      setCopyState("idle");
    } catch (error) {
      if (job !== jobRef.current) return;
      setResult(null);
      setMessage(error instanceof Error
        ? error.message
        : "Unable to encode this link. Make sure it points to supported media.");
    } finally {
      if (job === jobRef.current) setPending(false);
    }
  };

  const paste = async (second = false) => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (second) {
        setSecondLink(text);
      } else {
        setLink(text);
        if (!supportsNativeMoment(text)) setMoment("");
      }
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
          <div className="format-switch" role="group" aria-label="WaveCode format">
            {([
              ["v1", "V1 · classic"],
              ["v2", "V2 · single"],
              ["dual", "V2 · dual"],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={mode === value}
                className={mode === value ? "selected" : ""}
                onClick={() => { setMode(value); clearResult(); }}
              >{label}</button>
            ))}
          </div>

          <label htmlFor="track-link">{mode === "dual" ? "Spotify track link" : "Music or video link"}</label>
          <div className="input-wrap">
            <input
              id="track-link"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder={mode === "dual" ? "Spotify track URL…" : "Paste a music or video link…"}
              spellCheck={false}
              value={link}
              onChange={(event) => {
                const next = event.target.value;
                setLink(next);
                if (!supportsNativeMoment(next)) setMoment("");
                clearResult();
              }}
            />
            <button type="button" className="input-paste" onClick={() => void paste()} aria-label="Paste link from clipboard">
              Paste
            </button>
          </div>

          {mode === "dual" && (
            <>
              <label htmlFor="second-link">YouTube Music link</label>
              <div className="input-wrap">
                <input
                  id="second-link"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="YouTube Music watch URL…"
                  value={secondLink}
                  onChange={(event) => { setSecondLink(event.target.value); clearResult(); }}
                />
                <button type="button" className="input-paste" onClick={() => void paste(true)} aria-label="Paste YouTube Music link from clipboard">
                  Paste
                </button>
              </div>
              <p className="creator-hint">Both original IDs are stored losslessly. No cross-platform matching service.</p>
            </>
          )}

          {hasNativeMoment && <div className="moment-row">
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
          </div>}

          {mode !== "v1" && (
            <details className="creator-geometry">
              <summary>Adjust proportions <span>Visual only</span></summary>
              {([
                ["W size", logoHeight, setLogoHeight, 100, 400],
                ["Payload height", payloadHeight, setPayloadHeight, 110, 320],
                ["Middle gap", centerGap, setCenterGap, 4, 80],
                ["W-to-payload gap", blockGap, setBlockGap, 4, 150],
              ] as const).map(([label, value, setter, min, max]) => (
                <label className="geometry-control" key={label}>
                  <span>{label}<strong>{Math.round(value)} px</strong></span>
                  <input
                    aria-label={label}
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(event) => { setter(Number(event.target.value)); clearResult(); }}
                  />
                </label>
              ))}
              <p>Changing the W does not rescale the data. No dimensions are encoded.</p>
            </details>
          )}

          <button type="submit" className="create-submit" disabled={pending}>
            {pending ? "Creating…" : "Create WaveCode"}
          </button>
        </form>
      </div>

      {result && (
        <div className="output-panel">
          <WaveCodePreview svg={result.svg} />
          {result.urls && result.urls.length > 1 && (
            <div className="generated-links">
              {result.urls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  {platformLabel(url)}
                </a>
              ))}
            </div>
          )}
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
