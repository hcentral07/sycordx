/**
 * NoTrack — Sycord Core Plugin
 * Kills: analytics, Sentry crash reporting, Science API, logging endpoints.
 * Source: Vencord/NoTrack (improved)
 */

import { definePlugin, registerPlugin } from "@plugins";
import { findByProps } from "@webpack";

registerPlugin(definePlugin({
    name:        "NoTrack",
    description: "Blocks Discord analytics, Science endpoint, Sentry crash reporting, and all telemetry.",
    authors:     [{ name: "Sycord Core" }],
    required:    true,
    source:      "Vencord",
    tags:        ["Privacy"],
    category:    "Core",

    patches: [
        // ── Kill AnalyticsActionHandlers.track ────────────────────────────
        {
            find: "AnalyticsActionHandlers",
            replacement: {
                match: /track\s*\([^)]*\)\s*\{[^}]*\}/,
                replace: "track() { /* Sycord: killed */ }",
            },
        },
        // ── Nuke Science fetch ────────────────────────────────────────────
        {
            find: "/api/v9/science",
            replacement: {
                match: /fetch\([^)]+science[^)]*\)/g,
                replace: "Promise.resolve(new Response('{}',{status:200}))",
            },
        },
        // ── Remove Sentry init ────────────────────────────────────────────
        {
            find: "window.DiscordSentry",
            replacement: {
                match: /window\.DiscordSentry\s*=[^;]+;/,
                replace: "window.DiscordSentry={captureException:()=>{},captureMessage:()=>{}};",
            },
        },
        // ── Block crashReporter ───────────────────────────────────────────
        {
            find: "crashReporter.start",
            replacement: {
                match: /crashReporter\.start\([^)]*\)/,
                replace: "void 0",
            },
            optional: true,
        },
    ],

    start() {
        // Runtime belt-and-suspenders: also patch at the object level
        const analytics = findByProps("track", "AnalyticsActionHandlers");
        if (analytics) analytics.track = () => {};

        // XHR intercept for /science
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
            const urlStr = typeof url === "string" ? url : url.toString();
            if (urlStr.includes("/science") || urlStr.includes("/tracking")) {
                // return a dead XHR
                Object.defineProperty(this, "send", { value: () => {} });
                return;
            }
            return origOpen.apply(this, [method, url, ...rest] as any);
        };

        // fetch intercept
        const origFetch = window.fetch;
        window.fetch = function (input: any, init?: RequestInit) {
            const url = typeof input === "string" ? input : (input as Request).url;
            if (url?.includes("/science") || url?.includes("/track")) {
                return Promise.resolve(new Response("{}", { status: 200 }));
            }
            return origFetch.call(this, input, init);
        };

        console.log("[NoTrack] All telemetry blocked ✅");
    },
}));
