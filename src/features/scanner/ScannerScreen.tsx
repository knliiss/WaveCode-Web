import { useRef } from "react";
import {
  ArrowUpRight, Camera, Check, Flashlight, FlipHorizontal2, ImagePlus,
  LoaderCircle, RotateCcw, ScanLine, ShieldCheck,
} from "lucide-react";
import type { WaveCodeEngine } from "../../domain/wavecode";
import { useScanner } from "./useScanner";
import { ScanResultSheet } from "./ScanResultSheet";

interface Props { engine: WaveCodeEngine; active: boolean; }

export function ScannerScreen({ engine, active }: Props) {
  const scanner = useScanner(engine, active);
  const fileInput = useRef<HTMLInputElement>(null);
  const { view } = scanner;
  const running = view.phase === "scanning";
  const loading = view.phase === "starting" || view.phase === "uploading";

  return (
    <section className="scan-layout" aria-labelledby="scan-heading">
      <div className="heading-block">
        <div className="eyebrow"><span className="eyebrow-line" /> THE SCANNER <span className="tiny-index">/ 01</span></div>
        <h1 id="scan-heading">Find the <span>music.</span></h1>
        <p>Hold a WaveCode in view. We'll take it from there.</p>
      </div>

      <div className={"scanner-viewport " + (running ? "camera-active" : "")}>
        <video ref={scanner.videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
        {!running && view.phase !== "starting" && (
          <div className="scanner-placeholder" aria-hidden="true">
            <div className="placeholder-logo-wrap">
              <img src="./logo.svg" alt="" />
            </div>
            <div className="placeholder-copy">THE SPACE BETWEEN THE LINES</div>
          </div>
        )}
        {view.phase === "starting" && (
          <div className="scanner-loading"><LoaderCircle size={28} className="spin" /><span>Starting camera</span></div>
        )}

        <div className="scanner-topbar">
          <div className={"glass-status " + (running ? "glass-status-active" : "")}>
            <span className="live-dot" />
            <span>{running ? "LIVE CAPTURE" : loading ? "INITIALIZING" : "CAMERA OFF"}</span>
          </div>
          {running && (
            <div className="scan-tools">
              {view.torchSupported && (
                <button type="button" className={"glass-tool " + (view.torchEnabled ? "selected" : "")} aria-label={view.torchEnabled ? "Turn flashlight off" : "Turn flashlight on"} onClick={() => void scanner.toggleTorch()}>
                  <Flashlight size={18} />
                </button>
              )}
              <button type="button" className="glass-tool" aria-label="Switch camera" onClick={scanner.switchCamera}>
                <FlipHorizontal2 size={19} />
              </button>
            </div>
          )}
        </div>

        {running && (
          <div className="finder" aria-hidden="true">
            <i className="finder-corner corner-tl" /><i className="finder-corner corner-tr" />
            <i className="finder-corner corner-bl" /><i className="finder-corner corner-br" />
            <div className="finder-channel"><span /><span /><span /><span /><span /><span /><span /></div>
          </div>
        )}
        <div className="viewport-bottom">
          <span><ScanLine size={14} /> W A V E C O D E &nbsp; / &nbsp; V 1</span>
          <span>36 COLUMNS</span>
        </div>
        {view.result && (
          <ScanResultSheet codes={view.result.codes} onDismiss={scanner.dismissResult} onScanAgain={() => { scanner.dismissResult(); void scanner.start(); }} />
        )}
      </div>

      <div className="scan-feedback" role="status" aria-live="polite">
        <span className={"feedback-icon " + (view.phase === "error" ? "feedback-error" : "")}>
          {running ? <span className="pulse-dot" /> : loading ? <LoaderCircle size={17} className="spin" /> : view.phase === "found" ? <Check size={17} /> : <ShieldCheck size={17} />}
        </span>
        <span>{view.status}</span>
      </div>

      <div className="scan-actions">
        {running ? (
          <button className="action-primary" type="button" onClick={scanner.stop}>
            <span className="action-primary-icon"><RotateCcw size={19} /></span> Stop camera
          </button>
        ) : (
          <button className="action-primary" type="button" disabled={loading} onClick={() => void scanner.start()}>
            <span className="action-primary-icon"><Camera size={19} /></span>
            {loading ? "Working…" : view.phase === "error" ? "Try camera again" : "Open camera"}
            <ArrowUpRight size={18} className="action-tail" />
          </button>
        )}
        <button className="action-secondary" type="button" disabled={loading} onClick={() => fileInput.current?.click()}>
          <ImagePlus size={19} /><span>From photo</span>
        </button>
      </div>
      <input
        ref={fileInput}
        className="visually-hidden"
        aria-label="Choose a WaveCode photo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void scanner.scanPhoto(file);
        }}
      />
      <p className="privacy-note"><ShieldCheck size={15} /> Scans run on your device. Images aren't uploaded.</p>
    </section>
  );
}
