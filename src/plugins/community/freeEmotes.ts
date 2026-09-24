/**
 * FreeEmotes — Sycord Community Plugin
 * Bypasses Nitro gate on animated emojis and external stickers.
 * Patches the emoji "unavailable" reason check at source.
 * Source: Vencord/FakeNitro (selective port — emote bypass only)
 */

import { definePlugin, registerPlugin } from "@plugins";
import { findByProps } from "@webpack";
import { definePluginSettings } from "@api/settings";

const settings = definePluginSettings("FreeEmotes", {
    enableForStickers: {
        type:        "boolean",
        default:     true,
        description: "Also bypass sticker Nitro requirement",
    },
    enableAnimated: {
        type:        "boolean",
        default:     true,
        description: "Send animated emoji regardless of Nitro status",
    },
});

registerPlugin(definePlugin({
    name:        "FreeEmotes",
    description: "Use any emoji and sticker without Nitro. No more :(.",
    authors:     [{ name: "Sycord" }],
    tags:        ["Nitro", "Fun"],
    category:    "Community",
    source:      "Vencord",
    settingsDef: settings._store,

    patches: [
        // ── Bypass getEmojiUnavailableReason ──────────────────────────────
        // Returns null = "no reason it's unavailable" = free to send
        {
            find: "getEmojiUnavailableReason",
            replacement: {
                match: /getEmojiUnavailableReason\s*\([^)]*\)\s*\{[^}]+\}/,
                replace: "getEmojiUnavailableReason(){return null;}",
            },
        },
        // ── Bypass isEmojiFiltered ────────────────────────────────────────
        {
            find: "isEmojiFiltered",
            replacement: {
                match: /isEmojiFiltered\s*\([^)]*\)\s*\{[^}]+\}/,
                replace: "isEmojiFiltered(){return false;}",
            },
            optional: true,
        },
        // ── Bypass sticker "can use" check ────────────────────────────────
        {
            find: "isStickerAvailable",
            replacement: {
                match: /isStickerAvailable\s*\([^)]*\)\s*\{[^}]+\}/,
                replace: "isStickerAvailable(){return true;}",
            },
            optional: true,
        },
        // ── Patch the emoji picker to show all emojis as available ────────
        {
            find: "PREMIUM_LOCKED",
            replacement: {
                match: /type:\s*"PREMIUM_LOCKED"/g,
                replace: 'type: "NORMAL"',
            },
            optional: true,
        },
    ],

    start() {
        // Runtime: also patch the emoji utilities object directly
        const EmojiUtils = findByProps("getEmojiUnavailableReason");
        if (EmojiUtils) {
            EmojiUtils.getEmojiUnavailableReason = () => null;
            console.log("[FreeEmotes] getEmojiUnavailableReason patched ✅");
        }

        if (settings.enableForStickers) {
            const StickerUtils = findByProps("isStickerAvailable", "getStickerById");
            if (StickerUtils) {
                StickerUtils.isStickerAvailable = () => true;
                console.log("[FreeEmotes] isStickerAvailable patched ✅");
            }
        }
    },
}));
