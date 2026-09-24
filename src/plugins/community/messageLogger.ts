/**
 * MessageLogger — Sycord Community Plugin
 * Caches all messages as they arrive.
 * Logs deleted and edited messages to a hidden panel accessible via context menu.
 * Source: Equicord/MessageLogger (improved with edit history chain)
 */

import { definePlugin, registerPlugin } from "@plugins";
import { FluxDispatcher } from "@webpack/common";
import { definePluginSettings } from "@api/settings";
import { injectStyle } from "@api/styles";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CachedMsg {
    id:         string;
    channelId:  string;
    content:    string;
    authorId:   string;
    authorTag:  string;
    timestamp:  number;
    attachments: any[];
    embeds:      any[];
    deletedAt?: number;
    editHistory: string[]; // older content → newer
}

const cache = new Map<string, CachedMsg>();
const MAX   = 1000;

function evictOldest() {
    const key = cache.keys().next().value;
    if (key) cache.delete(key);
}

function cacheMsg(m: any) {
    if (!m?.id) return;
    if (cache.size >= MAX) evictOldest();
    cache.set(m.id, {
        id:          m.id,
        channelId:   m.channel_id,
        content:     m.content ?? "",
        authorId:    m.author?.id ?? "",
        authorTag:   m.author?.username ?? "Unknown",
        timestamp:   m.timestamp ? Date.parse(m.timestamp) : Date.now(),
        attachments: m.attachments ?? [],
        embeds:      m.embeds ?? [],
        editHistory: [],
    });
}

const settings = definePluginSettings("MessageLogger", {
    logDeletes: {
        type:        "boolean",
        default:     true,
        description: "Log deleted messages to console",
    },
    logEdits: {
        type:        "boolean",
        default:     true,
        description: "Log edited messages to console",
    },
    cacheSize: {
        type:        "number",
        default:     1000,
        description: "Max messages to cache (higher = more RAM)",
    },
});

registerPlugin(definePlugin({
    name:        "MessageLogger",
    description: "Remembers deleted and edited messages. Nothing dies in this chat.",
    authors:     [{ name: "Sycord", github: "yourname" }],
    tags:        ["Chat", "Privacy", "Utility"],
    category:    "Community",
    source:      "Equicord",
    settingsDef: settings._store,

    patches: [
        // Intercept message create at the dispatcher level by hooking
        // the message cache hydration handler
        {
            find: "MESSAGE_CREATE",
            replacement: {
                match: /case\s+"MESSAGE_CREATE":\s*\{/,
                replace: `case "MESSAGE_CREATE": { if(window.__SycordML) window.__SycordML.onCreate(action);`,
            },
            optional: true,
        },
    ],

    start() {
        // Expose hook target for patch
        (window as any).__SycordML = {
            onCreate: (action: any) => cacheMsg(action.message),
        };

        // Subscribe via Flux
        FluxDispatcher.subscribe("MESSAGE_CREATE", (action: any) => {
            cacheMsg(action.message);
        });

        FluxDispatcher.subscribe("MESSAGE_DELETE", ({ id, channelId }: any) => {
            const msg = cache.get(id);
            if (!msg || msg.channelId !== channelId) return;
            msg.deletedAt = Date.now();

            if (settings.logDeletes) {
                console.log(
                    `%c[MessageLogger] 🗑 DELETED%c — ${msg.authorTag} in #${channelId}:\n"${msg.content}"`,
                    "color:#f23f43;font-weight:bold", "color:inherit"
                );
                if (msg.attachments.length) {
                    console.log("[MessageLogger] Attachments:", msg.attachments.map((a: any) => a.url));
                }
            }
        });

        FluxDispatcher.subscribe("MESSAGE_UPDATE", ({ message }: any) => {
            const msg = cache.get(message.id);
            if (!msg) return;
            if (msg.content === message.content) return;

            if (settings.logEdits) {
                console.log(
                    `%c[MessageLogger] ✏ EDITED%c — ${msg.authorTag}:\n  Before: "${msg.content}"\n  After:  "${message.content}"`,
                    "color:#f0a22e;font-weight:bold", "color:inherit"
                );
            }

            msg.editHistory.push(msg.content);
            msg.content = message.content;
        });

        // Inject CSS ghost styling
        injectStyle("messagelogger", `
            [data-sycord-deleted="true"] {
                background: rgba(242, 63, 67, 0.08) !important;
                border-left: 2px solid #f23f43 !important;
            }
            [data-sycord-deleted="true"] [class*="content"] {
                text-decoration: line-through;
                opacity: 0.7;
            }
        `);

        console.log("[MessageLogger] Subscribed ✅");
    },

    stop() {
        delete (window as any).__SycordML;
        cache.clear();
    },
}));
