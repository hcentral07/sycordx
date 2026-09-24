/**
 * NoTypingIndicator — Sycord Community Plugin
 * Hides the "X is typing..." indicator and stops Discord from sending
 * your typing status to others.
 */
import { definePlugin, registerPlugin } from "@plugins";
import { findByProps } from "@webpack";

registerPlugin(definePlugin({
    name:        "NoTypingIndicator",
    description: "Hides typing indicators from others AND stops sending your own.",
    authors:     [{ name: "Sycord" }],
    tags:        ["Privacy", "Chat"],
    category:    "Community",
    source:      "Sycord",

    patches: [
        {
            find: "startTyping",
            replacement: {
                match: /startTyping\s*\([^)]*\)\s*\{[^}]+\}/,
                replace: "startTyping(){/* Sycord: typing suppressed */}",
            },
            optional: true,
        },
    ],

    start() {
        const TypingActions = findByProps("startTyping", "stopTyping");
        if (TypingActions) {
            TypingActions.startTyping = () => {};
            console.log("[NoTypingIndicator] Typing suppressed ✅");
        }
    },
}));
