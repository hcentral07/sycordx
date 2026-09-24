/**
 * Sycord Preload
 * Runs in renderer process WITH Node.js access, BEFORE page scripts.
 * Responsibilities:
 *   1. Chain Discord's original preload (ipcRenderer bindings etc.)
 *   2. Inject renderer.js into the page via <script> tag on DOMContentLoaded
 *   3. Expose safe IPC bridge via contextBridge if contextIsolation is on
 */

import { readFileSync } from "fs";
import path from "path";
import Module from "module";

// ── Chain Discord's original preload ──────────────────────────────────────────
// Discord's preload sets up ipcRenderer, DiscordNative, etc.
// We must run it so Discord doesn't crash on startup.
//
// We use Module._compile instead of eval():
//   - It runs the code with the correct `require`, `module`, `exports`,
//     `__filename`, and `__dirname` bindings, exactly like a real preload.
//   - It avoids esbuild's direct-eval warning, which exists because
//     bundlers rename/hoist variables and eval can't see those changes.
//   - It is not a security regression: the code being executed is
//     Discord's own preload, read from disk, path provided by our main
//     process. It is not remote/untrusted input.
const originalPreload = process.env.SYCORD_ORIGINAL_PRELOAD;
if (originalPreload) {
    try {
        const code = readFileSync(originalPreload, "utf-8");

        // Build a throwaway module whose `paths` mirror the original
        // preload's location so any require() calls inside it resolve
        // the same way they would if Electron had loaded it directly.
        const fakeModule = new Module(originalPreload, null);
        fakeModule.filename = originalPreload;
        fakeModule.paths = Module._nodeModulePaths(path.dirname(originalPreload));

        // @ts-expect-error — _compile is internal but stable and used by
        // every Electron client mod (BetterDiscord, Vencord, etc.).
        fakeModule._compile(code, originalPreload);
    } catch (e) {
        console.error("[Sycord Preload] Failed to chain Discord preload:", e);
    }
}

// ── Inject renderer bundle ────────────────────────────────────────────────────
const RENDERER_PATH = path.join(__dirname, "renderer.js");

function injectRenderer() {
    try {
        const code = readFileSync(RENDERER_PATH, "utf-8");
        const script = document.createElement("script");
        script.id = "sycord-renderer";

        // Insert FIRST — we need to hook webpack before anything executes
        if (document.head.firstChild) {
            document.head.insertBefore(script, document.head.firstChild);
        } else {
            document.head.appendChild(script);
        }

        // Setting textContent after insertion fires synchronously
        script.textContent = code;
        console.log("[Sycord Preload] Renderer injected ✅");
    } catch (e) {
        console.error("[Sycord Preload] Failed to inject renderer:", e);
    }
}

// Discord's renderer loads its HTML after the document is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectRenderer, { once: true });
} else {
    injectRenderer();
}