/**
 * Sycord Preload
 * Runs in renderer process WITH Node.js access, BEFORE page scripts.
 *
 * Responsibilities:
 *   1. Chain Discord's original preload (ipcRenderer bindings etc.)
 *
 * That's it. Renderer code delivery is handled by the main process via
 * webContents.executeJavaScript() — see scripts/inject.mjs → makeHookCode().
 * This bypasses Discord's Content Security Policy entirely, which blocks
 * injected <script> tags in modern Discord builds.
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

        console.log("[Sycord Preload] Discord preload chained ✅");
    } catch (e) {
        console.error("[Sycord Preload] Failed to chain Discord preload:", e);
    }
} else {
    console.warn("[Sycord Preload] SYCORD_ORIGINAL_PRELOAD not set — Discord's preload will not run");
}