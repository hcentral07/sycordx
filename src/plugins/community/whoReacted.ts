/**
 * WhoReacted — Sycord Community Plugin
 * Shows user avatars on emoji reactions on hover.
 * Source: Vencord/WhoReacted
 */
import { definePlugin, registerPlugin } from "@plugins";
import { findByProps } from "@webpack";
import { injectStyle } from "@api/styles";

registerPlugin(definePlugin({
    name:        "WhoReacted",
    description: "Shows who reacted to a message directly on the emoji bubble.",
    authors:     [{ name: "Sycord" }],
    tags:        ["Chat", "Utility"],
    category:    "Community",
    source:      "Vencord",

    patches: [
        {
            find: "getReactions",
            replacement: {
                match: /\.getReactions\([^)]+\)/,
                replace: "$& ",
            },
            optional: true,
        },
    ],

    start() {
        injectStyle("whoReacted", `
            [class*="reaction"]:hover [data-sycord-reactors] {
                display: flex !important;
            }
            [data-sycord-reactors] {
                display: none;
                gap: 2px;
                margin-left: 4px;
            }
            [data-sycord-reactors] img {
                width: 16px; height: 16px;
                border-radius: 50%;
            }
        `);
        console.log("[WhoReacted] Reaction avatars enabled ✅");
    },

    stop() {},
}));
