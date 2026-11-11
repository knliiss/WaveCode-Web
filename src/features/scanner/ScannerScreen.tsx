import { useRef } from "react";
import { Flashlight, FlipHorizontal2, LoaderCircle } from "lucide-react";
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
  const showFeedback = view.phase === "uploading" || view.phase === "error" ||
    view.phase === "no-result" || (running && view.attempts > 10);

  return (
    <section className="scan-layout" aria-labelledby="scan-heading">
      <div className="heading-block">
        <h1 id="scan-heading">Find the <span>music.</span></h1>
      </div>

      <div className={"scanner-viewport " + (running ? "camera-active" : "")}>
        <video ref={scanner.videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
        {!running && view.phase !== "starting" && (
          <div className="scanner-placeholder" aria-hidden="true">
            <div className="placeholder-logo-wrap"><span className="brand-symbol" /></div>
          </div>
        )}
        {view.phase === "starting" && (
          <div className="scanner-loading">
            <LoaderCircle size={27} className="spin" /><span>Starting camera</span>
          </div>
        )}

        {running && (
          <>
            <div className="scanner-topbar">
              <div className="glass-status glass-status-active">
                <span className="live-dot" /><span>LIVE</span>
              </div>
              <div className="scan-tools">
                {view.exposureSupported && (
                  <button
                    type="button"
                    className={"glass-tool exposure-tool " + (view.exposureReduced ? "selected" : "")}
                    aria-label={view.exposureReduced ? "Restore camera exposure" : "Reduce camera exposure"}
                    aria-pressed={view.exposureReduced}
                    onClick={() => void scanner.toggleExposure()}
                  >
                    EV−
                  </button>
                )}
                {view.torchSupported && (
                  <button type="button" className={"glass-tool " + (view.torchEnabled ? "selected" : "")} aria-label={view.torchEnabled ? "Turn flashlight off" : "Turn flashlight on"} onClick={() => void scanner.toggleTorch()}>
                    <Flashlight size={18} />
                  </button>
                )}
                <button type="button" className="glass-tool" aria-label="Switch camera" onClick={scanner.switchCamera}>
                  <FlipHorizontal2 size={19} />
                </button>
              </div>
            </div>
            <div className="finder" aria-hidden="true">
              <i className="finder-corner corner-tl" /><i className="finder-corner corner-tr" />
              <i className="finder-corner corner-bl" /><i className="finder-corner corner-br" />
              <div className="finder-channel"><span /><span /><span /><span /><span /><span /><span /></div>
            </div>
          </>
        )}
        {view.result && (
          <ScanResultSheet codes={view.result.codes} onDismiss={scanner.dismissResult} onScanAgain={() => { scanner.dismissResult(); void scanner.start(); }} />
        )}
      </div>

      {showFeedback && (
        <div className="scan-feedback" role="status" aria-live="polite">
          <span className="feedback-marker" aria-hidden="true" />
          <span>{view.status}</span>
        </div>
      )}

      <div className="scan-actions">
        {running ? (
          <button className="action-primary" type="button" onClick={scanner.stop}>Stop camera</button>
        ) : (
          <button className="action-primary" type="button" disabled={loading} onClick={() => void scanner.start()}>
            {loading ? "Working…" : view.phase === "error" ? "Try camera again" : "Open camera"}
          </button>
        )}
        <button className="action-secondary" type="button" disabled={loading} onClick={() => fileInput.current?.click()}>
          From photo
        </button>
      </div>
      <input
        ref={fileInput}
        className="visually-hidden"
        aria-label="Choose a WaveCode photo"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void scanner.scanPhoto(file);
        }}
      />
    </section>
  );
}
