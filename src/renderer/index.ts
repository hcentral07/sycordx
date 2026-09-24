/**
 * Sycord Renderer Entry Point
 *
 * Execution order:
 *   1. initPatcher()      — arm the webpack chunk hook BEFORE any module loads
 *   2. register plugins   — (happens via import of plugins/index.ts at parse time)
 *   3. waitFor UserStore  — signal that Discord's initial module batch is done
 *   4. initSettings()     — load persisted settings
 *   5. initQuickCSS()     — restore user's custom CSS
 *   6. startPlugins()     — call start() on all enabled plugins
 */

import { initPatcher }    from "./patcher";
import { waitFor }        from "./webpack/index";
import { startPlugins }   from "../plugins/index";
import { initSettings }   from "./api/settings";
import { initQuickCSS }   from "./api/styles";

// ── Step 1: Hook webpack as early as possible ─────────────────────────────────
// This MUST happen before any Discord modules execute.
// The preload injects us at document_start / DOMContentLoaded,
// so we're guaranteed to be first.
initPatcher();
console.log("%c[Sycord] %cv" + SYCORD_VERSION + " %cinitialized",
    "color:#5865f2;font-weight:bold",
    "color:#23a55a;font-weight:bold",
    "color:inherit"
);

// ── Step 2: Plugins are registered at module parse time ───────────────────────
// (importing plugins/index.ts causes all registerPlugin() calls to fire,
//  which registers patches. Patches are then applied as webpack loads.)
// This import is here just for side-effects — do NOT remove.
import "../plugins/index";

// ── Step 3–6: Async boot sequence ────────────────────────────────────────────
(async () => {
    // Wait for UserStore — a reliable signal that Discord's core is loaded
    await waitFor((m: any) => m?.getCurrentUser && m?.getUser);
    console.log("[Sycord] Discord core ready — booting plugins...");

    // Load persisted settings from disk/localStorage
    await initSettings();

    // Restore QuickCSS
    initQuickCSS();

    // Start plugins in dependency order
    await startPlugins();

    console.log("%c[Sycord] %cAll plugins started ✅",
        "color:#5865f2;font-weight:bold",
        "color:#23a55a;font-weight:bold"
    );
})();

// ── Global debug surface ──────────────────────────────────────────────────────
import { getAllPlugins, isPluginEnabled } from "../plugins/index";
import { findByProps, findByCode }        from "./webpack/index";

(window as any).Sycord = {
    version:  SYCORD_VERSION,
    plugins:  { getAll: getAllPlugins, isEnabled: isPluginEnabled },
    webpack:  { findByProps, findByCode },
};
