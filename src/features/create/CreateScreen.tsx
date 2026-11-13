import { PlatformBadge } from "../../components/PlatformBadge";
import { platformFromUrl } from "../../domain/platform";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import type { GeneratedWaveCode, V2Geometry, WaveCodeEngine } from "../../domain/wavecode";
import {
  parseMoment, platformLabel, supportsNativeMoment, validateMusicLink,
} from "../../domain/music-url";
import { normalizeMediaInput } from "../../domain/normalize-media-input";
import { copyPngImage } from "../../infrastructure/clipboard";
import { downloadBytes, downloadSvg } from "../../infrastructure/download";
import { WaveCodePreview } from "./WaveCodePreview";

interface Props { engine: WaveCodeEngine; }
type CopyState = "idle" | "copying" | "copied";
type CreationMode = "single" | "dual";

export function CreateScreen({ engine }: Props) {
  const [mode, setMode] = useState<CreationMode>("single");
  const [link, setLink] = useState("");
  const [secondLink, setSecondLink] = useState("");
  const [moment, setMoment] = useState("");
  const [secondMoment, setSecondMoment] = useState("");
  const [payloadHeight, setPayloadHeight] = useState(172);
  const [logoHeight, setLogoHeight] = useState(125);
  const [centerGap, setCenterGap] = useState(11);
  const [blockGap, setBlockGap] = useState(20);
  const [result, setResult] = useState<GeneratedWaveCode | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const jobRef = useRef(0);
  const copyResetRef = useRef<number | undefined>(undefined);
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

  const setRawLink = (value: string, second: boolean) => {
    if (second) {
      setSecondLink(value);
      setSecondMoment("");
    } else {
      setLink(value);
      setMoment("");
    }
    clearResult();
  };

  const normalizeLink = (value: string, second: boolean, resetMoment = false) => {
    try {
      const normalized = normalizeMediaInput(value);
      if (second) {
        setSecondLink(normalized.link);
        if (normalized.moment || resetMoment) setSecondMoment(normalized.moment);
      } else {
        setLink(normalized.link);
        if (normalized.moment || resetMoment) setMoment(normalized.moment);
      }
      clearResult();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The media link is invalid.");
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>, second: boolean) => {
    const text = event.clipboardData.getData("text").trim();
    if (text.startsWith("https://")) {
      event.preventDefault();
      normalizeLink(text, second, true);
    }
  };

  const paste = async (second: boolean) => {
    try {
      normalizeLink(await navigator.clipboard.readText(), second, true);
    } catch {
      setMessage("Clipboard access isn't available. Paste the link manually.");
    }
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let firstLink: string;
    let otherLink: string | undefined;
    let firstSeconds: number | undefined;
    let otherSeconds: number | undefined;

    try {
      const first = normalizeMediaInput(link);
      const second = mode === "dual" ? normalizeMediaInput(secondLink) : undefined;
      const invalidFirst = validateMusicLink(first.link);
      const invalidSecond = second ? validateMusicLink(second.link) : null;
      if (invalidFirst || invalidSecond) {
        setMessage(invalidFirst ?? invalidSecond!);
        return;
      }
      firstLink = first.link;
      otherLink = second?.link;
      if (!supportsNativeMoment(firstLink) && (moment.trim() || first.moment)) {
        throw new Error("The first platform does not support native timestamps.");
      }
      if (otherLink && !supportsNativeMoment(otherLink) && (secondMoment.trim() || second?.moment)) {
        throw new Error("The second platform does not support native timestamps.");
      }
      firstSeconds = parseMoment(first.moment || moment);
      otherSeconds = second ? parseMoment(second.moment || secondMoment) : undefined;
      setLink(firstLink);
      if (second) setSecondLink(second.link);
      if (first.moment) setMoment(first.moment);
      if (second?.moment) setSecondMoment(second.moment);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The media link is invalid.");
      return;
    }

    const job = ++jobRef.current;
    setPending(true);
    setMessage("");
    try {
      await engine.initialize();
      const generated = otherLink !== undefined
        ? await engine.generateDual(firstLink, otherLink, firstSeconds, otherSeconds, geometry)
        : await engine.generate(firstLink, firstSeconds, 2, geometry);
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
          <div className="format-switch format-switch--two" role="group" aria-label="WaveCode format">
            {([
              ["single", "Single link"],
              ["dual", "Dual link"],
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

          <label htmlFor="track-link">{mode === "dual" ? "First media link" : "Music or video link"}</label>
          <div className="input-wrap">
            {platformFromUrl(link) && <PlatformBadge url={link} size="small" />}
            <input
              id="track-link"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="Paste any supported music or video link…"
              spellCheck={false}
              value={link}
              onChange={(event) => setRawLink(event.target.value, false)}
              onBlur={() => { if (link.startsWith("https://")) normalizeLink(link, false); }}
              onPaste={(event) => handlePaste(event, false)}
            />
            <button type="button" className="input-paste" onClick={() => void paste(false)} aria-label="Paste link from clipboard">
              Paste
            </button>
          </div>
          {supportsNativeMoment(link) && (
            <div className="moment-row">
              <div className="moment-description">
                <label htmlFor="track-moment">{mode === "dual" ? "First start moment" : "Start at a moment"}</label>
                <span className="creator-moment-hint">Optional · extracted from a pasted link</span>
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
          )}

          {mode === "dual" && (
            <>
              <label htmlFor="second-link">Second media link</label>
              <div className="input-wrap">
                {platformFromUrl(secondLink) && <PlatformBadge url={secondLink} size="small" />}
                <input
                  id="second-link"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="Any other supported link, including the same platform…"
                  value={secondLink}
                  onChange={(event) => setRawLink(event.target.value, true)}
                  onBlur={() => { if (secondLink.startsWith("https://")) normalizeLink(secondLink, true); }}
                  onPaste={(event) => handlePaste(event, true)}
                />
                <button type="button" className="input-paste" onClick={() => void paste(true)} aria-label="Paste second link from clipboard">
                  Paste
                </button>
              </div>
              {supportsNativeMoment(secondLink) && (
                <div className="moment-row">
                  <div className="moment-description">
                    <label htmlFor="second-moment">Second start moment</label>
                    <span className="creator-moment-hint">Independent from the first link</span>
                  </div>
                  <div className="moment-field">
                    <input
                      id="second-moment"
                      type="text"
                      inputMode="numeric"
                      placeholder="00:00"
                      value={secondMoment}
                      onChange={(event) => { setSecondMoment(event.target.value); clearResult(); }}
                      maxLength={8}
                    />
                  </div>
                </div>
              )}
              <p className="creator-hint">Both links are stored independently, without matching tracks across platforms.</p>
            </>
          )}

          <details className="creator-geometry">
            <summary>Adjust proportions <span>Visual only</span></summary>
            {([
              ["W size", logoHeight, setLogoHeight, 90, 300],
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
            <p>Dimensions and gaps do not encode information. Keep every capsule legible when printing.</p>
          </details>

          <button type="submit" className="create-submit" disabled={pending}>
            {pending ? "Creating…" : "Create WaveCode"}
          </button>
        </form>
      </div>

      {result && (
        <div className="output-panel">
          <WaveCodePreview svg={result.svg} />
          <div className="generated-links" aria-label="Encoded destinations">
            {(result.urls?.length ? result.urls : [result.canonicalUrl]).map((url, index) => (
              <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                <PlatformBadge url={url} size="small" />
                <span>Open {platformLabel(url)}</span>
              </a>
            ))}
          </div>
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
