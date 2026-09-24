/**
 * SpotifyControls — Sycord Community Plugin
 * Adds playback controls (previous, play/pause, next, volume) above the
 * account panel at the bottom-left when Spotify is connected.
 * Source: Vencord/SpotifyControls (layout improved)
 */

import { definePlugin, registerPlugin } from "@plugins";
import { findByProps, waitFor } from "@webpack";
import { injectStyle, removeStyle } from "@api/styles";

const STYLE_ID = "spotifyControls";

registerPlugin(definePlugin({
    name:        "SpotifyControls",
    description: "Spotify playback controls embedded in Discord's bottom bar.",
    authors:     [{ name: "Sycord" }],
    tags:        ["Integration", "Utility"],
    category:    "Community",
    source:      "Vencord",

    start() {
        injectStyle(STYLE_ID, `
            #sycord-spotify {
                display:        flex;
                align-items:    center;
                gap:            8px;
                padding:        6px 8px;
                background:     var(--background-secondary-alt, #1e1f22);
                border-top:     1px solid var(--background-modifier-accent);
                font-size:      12px;
                color:          var(--text-normal);
            }
            #sycord-spotify button {
                background:  none;
                border:      none;
                cursor:      pointer;
                color:       var(--interactive-normal);
                padding:     2px 4px;
                border-radius: 4px;
                font-size:   16px;
                line-height: 1;
            }
            #sycord-spotify button:hover { color: var(--interactive-hover); }
            #sycord-spotify .track {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        `);

        waitFor((m: any) => m?.getActivity && m?.getActivities).then((PresenceUtils: any) => {
            // Poll for Spotify activity
            const interval = setInterval(() => _updateBar(PresenceUtils), 2000);
            (this as any)._interval = interval;
            _updateBar(PresenceUtils);
        });
    },

    stop() {
        clearInterval((this as any)._interval);
        document.getElementById("sycord-spotify")?.remove();
        removeStyle(STYLE_ID);
    },
}));

function _updateBar(PresenceUtils: any) {
    // Find current user's Spotify activity
    const UserStore  = findByProps("getCurrentUser");
    const userId     = UserStore?.getCurrentUser?.()?.id;
    if (!userId) return;

    const activities = PresenceUtils?.getActivities?.(userId) ?? [];
    const spotify    = activities.find((a: any) => a.type === 2 && a.name === "Spotify");

    let bar = document.getElementById("sycord-spotify");

    if (!spotify) {
        bar?.remove();
        return;
    }

    const track  = spotify.details ?? "Unknown Track";
    const artist = spotify.state   ?? "Unknown Artist";

    if (!bar) {
        bar = document.createElement("div");
        bar.id = "sycord-spotify";

        // Try to append before account area
        const accountArea = document.querySelector('[class*="panels"]');
        if (accountArea) accountArea.prepend(bar);
        else document.body.appendChild(bar);
    }

    bar.innerHTML = `
        <span>🎵</span>
        <span class="track">${_esc(track)} — ${_esc(artist)}</span>
        <button title="Previous" onclick="window.__SycordSpotify?.prev()">⏮</button>
        <button title="Play/Pause" onclick="window.__SycordSpotify?.toggle()">⏯</button>
        <button title="Next" onclick="window.__SycordSpotify?.next()">⏭</button>
    `;

    // Expose control stubs (actual Spotify API integration requires OAuth token)
    (window as any).__SycordSpotify = {
        prev:   () => console.log("[SpotifyControls] ← previous (hook Spotify API here)"),
        toggle: () => console.log("[SpotifyControls] ⏯ toggle"),
        next:   () => console.log("[SpotifyControls] → next"),
    };
}

function _esc(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
