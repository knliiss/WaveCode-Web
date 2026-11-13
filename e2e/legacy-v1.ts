import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/** Exercise the backward-compatible V1 Worker API without exposing a V1 creator in the UI. */
export async function createLegacyV1Png(page: Page, url: string, moment?: number): Promise<Buffer> {
  const workerFile = readdirSync(join(process.cwd(), "dist", "assets"))
    .find((name) => /^worker-[A-Za-z0-9_-]+\.js$/.test(name));
  if (!workerFile) throw new Error("The bundled WaveCode Worker was not found.");

  const bytes = await page.evaluate(
    ({ workerFile, url, moment }) => new Promise<number[]>((resolve, reject) => {
      const worker = new Worker("/assets/" + workerFile, { type: "module" });
      worker.onmessage = (event: MessageEvent<{
        id: number;
        ok: boolean;
        value?: { png: Uint8Array };
        error?: string;
      }>) => {
        worker.terminate();
        if (event.data.ok && event.data.value?.png) {
          resolve(Array.from(event.data.value.png));
        } else {
          reject(new Error(event.data.error ?? "Legacy V1 encoder failed."));
        }
      };
      worker.onerror = () => {
        worker.terminate();
        reject(new Error("Could not load the legacy V1 Worker."));
      };
      worker.postMessage({ id: 1, action: "generate", url, moment, version: 1, width: 960, height: 240 });
    }),
    { workerFile, url, moment },
  );
  return Buffer.from(bytes);
}
