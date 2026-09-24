/**
 * Sycord Patcher Engine
 *
 * Hooks Discord's webpack chunk push mechanism at the earliest possible moment.
 * Every module factory is wrapped so patches can rewrite its source before eval.
 *
 * Patch application order:
 *   1. Patch is registered via registerPatch()
 *   2. When a chunk is pushed, each factory's .toString() is checked against patch.find
 *   3. If matched, patch.replacement(s) are applied via String.replace()
 *   4. Patched source is re-eval'd via new Function(...)
 *   5. If patched factory throws, original factory runs as fallback + error logged
 */

import { onModuleLoaded, setWebpackRequire } from "./webpack/index";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PatchReplacement {
    /** Pattern to match in the module source */
    match: RegExp | string;
    /** Replacement string or function */
    replace: string | ((...args: string[]) => string);
}

export interface Patch {
    /** Plugin name (for debug attribution) */
    plugin: string;
    /** Substring that must exist in the module source for this patch to apply */
    find: string;
    /** One or more replacements applied in order */
    replacement: PatchReplacement | PatchReplacement[];
    /** If true, patch is skipped silently when find doesn't match (optional/best-effort) */
    optional?: boolean;
}

// ── Patch registry ────────────────────────────────────────────────────────────
const patches: Patch[] = [];
let webpackBooted = false;

export function registerPatch(patch: Patch) {
    if (webpackBooted) {
        // Webpack already running — this patch is too late for most modules
        console.warn(`[Sycord/Patcher] Late patch from ${patch.plugin}: "${patch.find}" — may miss modules`);
    }
    patches.push(patch);
}

// ── Webpack chunk array hook ──────────────────────────────────────────────────
const CHUNK_ARRAY_NAME = "webpackChunkdiscord_app";

export function initPatcher() {
    // Discord's webpack pushes chunks as:
    // webpackChunkdiscord_app.push([[chunkId], { moduleId: factory, ... }, runtimeFn])
    //
    // We intercept the array's .push method.
    // Electron renders Discord's bundle after our preload script runs,
    // so we're guaranteed to define this before any Discord code.

    const existingChunks: unknown[] = (window as any)[CHUNK_ARRAY_NAME] ?? [];
    const hookedArray: unknown[] = [];

    // Replay already-pushed chunks (shouldn't happen on fresh load, but be safe)
    for (const chunk of existingChunks) {
        interceptChunk(chunk);
        hookedArray.push(chunk);
    }

    // Override push
    const originalArrayPush = Array.prototype.push.bind(hookedArray);

    (hookedArray as any).push = function (...args: any[]) {
        for (const chunk of args) {
            interceptChunk(chunk);
        }
        return originalArrayPush(...args);
    };

    // Replace the global with our hooked version
    Object.defineProperty(window, CHUNK_ARRAY_NAME, {
        get: ()  => hookedArray,
        set: (newVal) => {
            // Discord may re-assign the array — absorb its contents
            if (Array.isArray(newVal)) {
                for (const chunk of newVal) {
                    if (!hookedArray.includes(chunk)) {
                        interceptChunk(chunk);
                        originalArrayPush(chunk);
                    }
                }
            }
        },
        configurable: true,
    });

    console.log("[Sycord/Patcher] Webpack hook armed 🔫");
}

// ── Chunk interception ────────────────────────────────────────────────────────
function interceptChunk(chunk: unknown) {
    if (!Array.isArray(chunk) || chunk.length < 2) return;

    // chunk = [[ids...], { moduleId: factory }, runtimeFn?]
    const [, modules, runtime] = chunk as [unknown[], Record<string, Function>, Function?];

    if (modules && typeof modules === "object") {
        for (const id of Object.getOwnPropertyNames(modules)) {
            const factory = modules[id];
            if (typeof factory !== "function") continue;
            modules[id] = buildPatchedFactory(factory, id);
        }
    }

    // Capture webpack require from the runtime callback
    if (typeof runtime === "function") {
        chunk[2] = function (req: any) {
            if (!webpackBooted) {
                webpackBooted = true;
                setWebpackRequire(req);
                console.log("[Sycord/Patcher] webpack require captured ✅");
            }
            return runtime(req);
        };
    }
}

// ── Patched factory builder ───────────────────────────────────────────────────
const appliedPatchCount: Record<string, number> = {};

function buildPatchedFactory(original: Function, moduleId: string): Function {
    const src = Function.prototype.toString.call(original);

    // Fast path: no patches match this module
    const applicable = patches.filter(p => src.includes(p.find));
    if (applicable.length === 0) {
        return wrapWithExportHook(original, moduleId);
    }

    return function (module: any, exports: any, require: any) {
        let patchedSrc = src;

        for (const patch of applicable) {
            const replacements = Array.isArray(patch.replacement)
                ? patch.replacement
                : [patch.replacement];

            for (const rep of replacements) {
                const before = patchedSrc;
                try {
                    patchedSrc = patchedSrc.replace(rep.match as any, rep.replace as any);
                } catch (e) {
                    console.error(`[Sycord/Patcher] [${patch.plugin}] replace() threw on module ${moduleId}:`, e);
                }
                if (patchedSrc === before && !patch.optional) {
                    console.warn(`[Sycord/Patcher] [${patch.plugin}] find="${patch.find}" matched but replace had no effect on module ${moduleId}`);
                }
            }

            appliedPatchCount[patch.plugin] = (appliedPatchCount[patch.plugin] ?? 0) + 1;
        }

        try {
            // Strip "function(module,exports,require){...}" wrapper that toString() adds
            // then re-wrap as a proper function body
            const body = patchedSrc
                .replace(/^function[^(]*\(/, "(function(")
                .replace(/\)[\s\S]*?\{/, "){") // normalize args block
            ;

            // eslint-disable-next-line no-new-func
            const patchedFn = new Function("module", "exports", "require",
                `(${patchedSrc}).call(this, module, exports, require);`
            );
            patchedFn(module, exports, require);
        } catch (e) {
            console.error(`[Sycord/Patcher] Patched module ${moduleId} crashed, using original:`, e);
            original.call(null, module, exports, require);
        }

        if (module.exports) onModuleLoaded(module.exports);
    };
}

function wrapWithExportHook(original: Function, _moduleId: string): Function {
    return function (module: any, exports: any, require: any) {
        original.call(null, module, exports, require);
        if (module.exports) onModuleLoaded(module.exports);
    };
}

// ── Debug helper (available in devtools) ─────────────────────────────────────
(window as any).__SycordPatcher = {
    getPatches:     () => patches,
    getApplyCount:  () => appliedPatchCount,
};
