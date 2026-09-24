/**
 * ─────────────────────────────────────────────────────────
 *  SYCORD USER PLUGIN TEMPLATE
 *  Drop your .ts files in this folder — they're your plugins.
 *  This file is an example. Rename, duplicate, and go wild.
 * ─────────────────────────────────────────────────────────
 *
 * Minimum viable plugin:
 *
 *   import { definePlugin, registerPlugin } from "@plugins";
 *   registerPlugin(definePlugin({ name: "MyPlugin", ... }));
 *
 * Full API surface shown below.
 */

import { definePlugin, registerPlugin } from "@plugins";
import { findByProps, waitFor }         from "@webpack";
import { FluxDispatcher }               from "@webpack/common";
import { injectStyle, removeStyle }     from "@api/styles";
import { showToast, ToastType }         from "@api/notifications";
import { definePluginSettings }         from "@api/settings";

// ── 1. Define your settings (optional) ───────────────────────────────────────
const settings = definePluginSettings("ExamplePlugin", {
    coolMode: {
        type:        "boolean",
        default:     true,
        description: "Enable the cool mode™",
    },
    prefix: {
        type:        "string",
        default:     ">>",
        description: "Prefix for the command trigger",
    },
});

// ── 2. Register the plugin ────────────────────────────────────────────────────
registerPlugin(definePlugin({
    name:        "ExamplePlugin",
    description: "A template user plugin — replace everything below with your logic.",
    authors:     [{ name: "YourName", github: "yourGithub" }],
    tags:        ["Utility"],         // Chat | Voice | Server | Appearance | Privacy | Fun | Utility | Developer | Nitro
    category:    "UserPlugin",
    source:      "UserPlugin",
    settingsDef: settings._store,

    // ── Optional: webpack patches ─────────────────────────────────────────────
    // Applied BEFORE Discord's modules execute — most powerful hook point.
    // Omit this array entirely if you don't need patches.
    patches: [
        {
            // find must be a unique substring present in the target module source
            find: "someUniqueDiscordInternalString",
            replacement: {
                match: /someRegex\(([^)]+)\)/,
                replace: "someReplacement($1)",
            },
            optional: true,   // don't crash if find doesn't match (safe for optional patches)
        },
    ],

    // ── start() — runs once when plugin is enabled ────────────────────────────
    start() {
        // Access your settings
        if (settings.coolMode) {
            console.log(`[ExamplePlugin] Cool mode ON, prefix: "${settings.prefix}"`);
        }

        // Inject CSS
        injectStyle("exampleplugin", `
            /* Your styles here */
            [class*="message"]:hover { outline: 1px solid #5865f2; }
        `);

        // Subscribe to Discord events
        FluxDispatcher.subscribe("MESSAGE_CREATE", this._onMessage.bind(this));

        // Find a Discord module by properties
        const MessageActions = findByProps("sendMessage", "editMessage");
        if (MessageActions) {
            // e.g. hook sendMessage
            const origSend = MessageActions.sendMessage.bind(MessageActions);
            MessageActions.sendMessage = (...args: any[]) => {
                console.log("[ExamplePlugin] Message sent:", args[0]);
                return origSend(...args);
            };
            (this as any)._origSend     = origSend;
            (this as any)._msgActions   = MessageActions;
        }

        // Wait for an async module
        waitFor((m: any) => m?.getUserAvatarURL).then((AvatarUtils: any) => {
            console.log("[ExamplePlugin] AvatarUtils loaded:", AvatarUtils);
        });

        showToast("ExamplePlugin started! 🔥", { type: ToastType.Success });
    },

    // ── stop() — cleanup when plugin is disabled ──────────────────────────────
    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", this._onMessage.bind(this));
        removeStyle("exampleplugin");

        // Restore patched functions
        const msgActions = (this as any)._msgActions;
        const origSend   = (this as any)._origSend;
        if (msgActions && origSend) {
            msgActions.sendMessage = origSend;
        }
    },

    // ── Your methods ──────────────────────────────────────────────────────────
    _onMessage(action: any) {
        const msg = action.message;
        if (msg?.content?.startsWith(settings.prefix)) {
            console.log("[ExamplePlugin] Command triggered:", msg.content);
        }
    },
}));
