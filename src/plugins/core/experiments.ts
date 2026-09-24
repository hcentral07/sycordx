/**
 * Experiments — Sycord Core Plugin
 * Unlocks Discord's hidden Experiments tab + forces all experiment buckets
 * into treatment group 1 (enabled state).
 * Source: Vencord/Experiments (improved bucket override)
 */

import { definePlugin, registerPlugin } from "@plugins";
import { findByProps, waitFor } from "@webpack";

registerPlugin(definePlugin({
    name:        "Experiments",
    description: "Enables Discord's hidden Experiments tab and forces all experiment buckets to treatment.",
    authors:     [{ name: "Sycord Core" }],
    required:    true,
    source:      "Vencord",
    tags:        ["Developer"],
    category:    "Core",

    patches: [
        // ── Patch isDeveloper to always be true ───────────────────────────
        {
            find: "isDeveloper",
            replacement: {
                match: /isDeveloper\s*[:=]\s*\w+\.isDeveloper\b/,
                replace: "isDeveloper: true",
            },
        },
        // ── Force all experiment buckets → 1 (treatment) ──────────────────
        {
            find: "getExperimentBucket",
            replacement: {
                match: /getExperimentBucket\(\w+\)\s*\{[^}]+\}/,
                replace: "getExperimentBucket(){return 1;}",
            },
            optional: true,
        },
        // ── Skip the "requires Nitro" check in experiments panel ──────────
        {
            find: "isStaff",
            replacement: {
                match: /isStaff\s*[:=]\s*[^,}]+/,
                replace: "isStaff: true",
            },
            optional: true,
        },
    ],

    start() {
        // Runtime fallback: mutate ExperimentStore directly
        waitFor((m: any) => m?.getExperimentBucket && m?.hasExperiment).then((store: any) => {
            const orig = store.getExperimentBucket.bind(store);
            store.getExperimentBucket = (...args: unknown[]) => {
                const bucket = orig(...args);
                // 0 = control (disabled), >0 = treatment
                return bucket === 0 ? 1 : bucket;
            };
            console.log("[Experiments] Buckets overridden → treatment ✅");
        });
    },
}));
