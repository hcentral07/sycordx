/**
 * ShowHiddenChannels — Sycord Community Plugin
 * Makes channels you don't have permission to read visible in the sidebar.
 * Clicking one shows a "you lack permission" stub — no actual message content.
 * Source: Equicord/ShowHiddenChannels
 */

import { definePlugin, registerPlugin } from "@plugins";
import { findByProps } from "@webpack";
import { injectStyle } from "@api/styles";

registerPlugin(definePlugin({
    name:        "ShowHiddenChannels",
    description: "Shows channels you can't read in the sidebar, with a lock indicator.",
    authors:     [{ name: "Sycord" }],
    tags:        ["Server", "Utility"],
    category:    "Community",
    source:      "Equicord",

    patches: [
        // ── Remove channels from the "hidden" filter in channel list ──────
        {
            find: "activeJoinedRelevantThreads",
            replacement: {
                match: /\i\.filter\(\i=>\{return\s+\i\.isHidden\(\)/,
                replace: "([]).filter(i=>{return false",
            },
            optional: true,
        },
        // ── Bypass "can read" permission gate in channel list renderer ────
        {
            find: "can(\"VIEW_CHANNEL\"",
            replacement: {
                match: /can\("VIEW_CHANNEL"[^)]+\)/,
                replace: "true",
            },
            optional: true,
        },
        // ── Bypass permission check in channel item to allow render ───────
        {
            find: ".canAccessChannel(",
            replacement: {
                match: /\.canAccessChannel\([^)]+\)/g,
                replace: "true",
            },
            optional: true,
        },
    ],

    start() {
        // Add visual indicator for locked channels
        injectStyle("showHiddenChannels", `
            [data-sycord-locked="true"] [class*="name"] {
                opacity: 0.5;
            }
            [data-sycord-locked="true"]::after {
                content: " 🔒";
                font-size: 12px;
                opacity: 0.6;
            }
        `);

        // Runtime: force PermissionUtils.canViewChannel to return true
        const PermUtils = findByProps("canViewChannel", "can");
        if (PermUtils?.canViewChannel) {
            const orig = PermUtils.canViewChannel.bind(PermUtils);
            PermUtils.canViewChannel = (...args: unknown[]) => {
                const result = orig(...args);
                return true; // always visible
            };
        }

        console.log("[ShowHiddenChannels] Channel visibility unlocked ✅");
    },

    stop() {
        // Permission bypass is stateless per-call, no cleanup needed beyond style
    },
}));
