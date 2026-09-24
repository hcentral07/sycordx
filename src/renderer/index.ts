/**
 * Sycord Renderer Entry Point
 *
 * Execution order:
 *   1. Expose window.Sycord (so the preload's success check always passes)
 *   2. initPatcher()      — arm the webpack chunk hook BEFORE any module loads
 *   3. Dynamic-import plugins — one bad plugin must not kill the whole boot
 *   4. waitFor UserStore  — signal that Discord's initial module batch is done
 *   5. initSettings()     — load persisted settings
 *   6. initQuickCSS()     — restore user's custom CSS
 *   7. startPlugins()     — call start() on all enabled plugins
 *
 * NOTE: imports of plugin files MUST be dynamic (await import(...)) so we can
 * wrap them in try/catch. A top-level static import of "../plugins/index" runs
 * every plugin's module-scope code before webpack is captured, and if any of
 * them touches a store at module scope it throws before we can catch it.
 */

import { initPatcher }                 from "./patcher";
import { waitFor, findByProps, findByCode } from "./webpack/index";
import { startPlugins, getAllPlugins, isPluginEnabled } from "../plugins/index";
import { initSettings }                from "./api/settings";
import { initQuickCSS }                from "./api/styles";

// ── Step 0: Expose the global FIRST ──────────────────────────────────────────
// The main process's executeJavaScript() promise resolves only if this script
// doesn't throw on evaluation. We set window.Sycord as the very first statement
// so it exists no matter what happens later.
(window as any).Sycord = {
    version:  SYCORD_VERSION,
    plugins:  { getAll: getAllPlugins, isEnabled: isPluginEnabled },
    webpack:  { findByProps, findByCode },
    ready:    false,
    errors:   [] as string[],
};

// ── Step 1: Hook webpack as early as possible ────────────────────────────────
// This MUST happen before any Discord modules execute.
// The main process calls executeJavaScript() at did-finish-load, so we're
// running as early as the renderer allows.
try {
    initPatcher();
    console.log(
        "%c[Sycord] %cv" + SYCORD_VERSION + " %cinitialized",
        "color:#5865f2;font-weight:bold",
        "color:#23a55a;font-weight:bold",
        "color:inherit"
    );
} catch (e) {
    console.error("[Sycord] initPatcher() failed:", e);
    (window as any).Sycord.errors.push("initPatcher: " + (e as Error).message);
}

// ── Step 2–7: Async boot sequence ────────────────────────────────────────────
(async () => {
    // ── Step 2: Load plugins inside a try/catch ──────────────────────────────
    // Every plugin file runs its registerPlugin() at import time. If any plugin
    // has module-scope code that touches a webpack store before it's ready
    // (e.g. `const X = findByProps(...); X.has(...)`) it will throw. Wrapping
    // the import means a broken plugin logs an error but the rest of the boot
    // sequence still runs.
    try {
        await import("../plugins/index");
        console.log("[Sycord] Plugins registered");
    } catch (e) {
        console.error("[Sycord] Plugin registration failed:", e);
        (window as any).Sycord.errors.push("plugin import: " + (e as Error).message);
        // Continue — we still want the settings panel to be reachable so the
        // user can see which plugin blew up.
    }

    // ── Step 3: Wait for Discord's core to load ──────────────────────────────
    try {
        await waitFor((m: any) => m?.getCurrentUser && m?.getUser);
        console.log("[Sycord] Discord core ready — booting plugins...");
    } catch (e) {
        console.error("[Sycord] waitFor(UserStore) failed:", e);
        (window as any).Sycord.errors.push("waitFor: " + (e as Error).message);
        return;
    }

    // ── Step 4: Load persisted settings ──────────────────────────────────────
    try {
        await initSettings();
    } catch (e) {
        console.error("[Sycord] initSettings() failed:", e);
        (window as any).Sycord.errors.push("initSettings: " + (e as Error).message);
    }

    // ── Step 5: Restore QuickCSS ─────────────────────────────────────────────
    try {
        initQuickCSS();
    } catch (e) {
        console.error("[Sycord] initQuickCSS() failed:", e);
        (window as any).Sycord.errors.push("initQuickCSS: " + (e as Error).message);
    }

    // ── Step 6: Start plugins ────────────────────────────────────────────────
    try {
        await startPlugins();
        console.log(
            "%c[Sycord] %cAll plugins started ✅",
            "color:#5865f2;font-weight:bold",
            "color:#23a55a;font-weight:bold"
        );
    } catch (e) {
        console.error("[Sycord] startPlugins() failed:", e);
        (window as any).Sycord.errors.push("startPlugins: " + (e as Error).message);
    }

    // ── Done ─────────────────────────────────────────────────────────────────
    (window as any).Sycord.ready = true;
    console.log("[Sycord] Boot complete. Errors:", (window as any).Sycord.errors);
})();