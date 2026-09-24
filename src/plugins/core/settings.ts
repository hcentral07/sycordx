/**
 * Sycord Settings Panel
 *
 * Adds a "⚡ Sycord" entry to Discord's User Settings sidebar and renders
 * the plugin list with enable/disable toggles.
 *
 * We do NOT use declarative patches here. Patch-by-source-regex on Discord's
 * settings internals is brittle (their source changes every release) and
 * your patcher doesn't support Vencord's $self convention. Instead we:
 *   1. Inject a sidebar entry via DOM (works regardless of Discord internals)
 *   2. Render the Sycord panel as a full-screen overlay with the plugin list
 *
 * This is a fallback-grade solution. A proper panel would patch Discord's
 * settings switch, but that requires more patcher infrastructure than Sycord
 * has today.
 */

import { definePlugin, registerPlugin, getAllPlugins, isPluginEnabled, setPluginEnabled } from "@plugins";
import { FluxDispatcher } from "@webpack/common";

// ── Guard: FluxDispatcher may be null if webpack finder hasn't resolved ──────
// findByPropsLazy returns a proxy that yields undefined for every prop if the
// underlying finder returned null. Calling .subscribe() on that throws.
// We check before subscribing and skip cleanly if unavailable.
function safeSubscribe(event: string, cb: () => void): boolean {
    try {
        const dispatcher: any = FluxDispatcher;
        if (!dispatcher || typeof dispatcher.subscribe !== "function") {
            console.warn(`[Sycord/Settings] FluxDispatcher unavailable — cannot subscribe to ${event}`);
            return false;
        }
        dispatcher.subscribe(event, cb);
        return true;
    } catch (e) {
        console.warn(`[Sycord/Settings] subscribe(${event}) failed:`, e);
        return false;
    }
}

// ── Sidebar injection ────────────────────────────────────────────────────────
const ENTRY_ID  = "sycord-settings-entry";
const PANEL_ID  = "sycord-panel-overlay";

function removeExistingEntry() {
    document.getElementById(ENTRY_ID)?.remove();
}

function findSidebarContainer(): HTMLElement | null {
    // Discord's settings sidebar is a scroll container. The class names are
    // hashed, so we look for the "My Account" nav item and walk up.
    // This is more reliable than guessing class name fragments.
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("div, nav, aside"));

    for (const el of candidates) {
        // The sidebar contains a clickable element whose text is "My Account"
        // (or the localized equivalent). Walk up from there.
        const hasMyAccount = el.textContent?.includes("My Account") || el.textContent?.includes("My account");
        if (!hasMyAccount) continue;

        // Only accept reasonably narrow containers (a sidebar, not the whole page)
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.width < 400 && rect.height > 100) {
            return el;
        }
    }
    return null;
}

function injectSidebarEntry() {
    if (document.getElementById(ENTRY_ID)) return;

    const sidebar = findSidebarContainer();
    if (!sidebar) return;

    const entry = document.createElement("div");
    entry.id = ENTRY_ID;
    entry.setAttribute("data-sycord", "true");
    entry.textContent = "⚡ Sycord";
    Object.assign(entry.style, {
        padding:      "6px 10px",
        margin:       "4px 8px",
        borderRadius: "4px",
        cursor:       "pointer",
        color:        "var(--interactive-normal, #b5bac1)",
        fontSize:     "14px",
        fontWeight:   "500",
        transition:   "background 0.15s, color 0.15s",
        userSelect:   "none",
    });

    entry.addEventListener("mouseenter", () => {
        entry.style.background = "var(--background-modifier-hover, #35373c)";
        entry.style.color      = "var(--interactive-hover, #dbdee1)";
    });
    entry.addEventListener("mouseleave", () => {
        entry.style.background = "";
        entry.style.color      = "var(--interactive-normal, #b5bac1)";
    });
    entry.addEventListener("click", openSycordPanel);

    sidebar.appendChild(entry);
    console.log("[Sycord/Settings] Sidebar entry injected");
}

// ── Panel rendering ──────────────────────────────────────────────────────────
function closeSycordPanel() {
    document.getElementById(PANEL_ID)?.remove();
    document.removeEventListener("keydown", onPanelKeyDown);
}

function onPanelKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") closeSycordPanel();
}

function openSycordPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const plugins = getAllPlugins().sort((a, b) => a.name.localeCompare(b.name));
    const enabledCount = plugins.filter(p => isPluginEnabled(p.name)).length;

    const overlay = document.createElement("div");
    overlay.id = PANEL_ID;
    Object.assign(overlay.style, {
        position:   "fixed",
        top: "0", left: "0", right: "0", bottom: "0",
        zIndex:     "9999",
        background: "var(--background-primary, #313338)",
        color:      "var(--text-normal, #dbdee1)",
        overflowY:  "auto",
        padding:    "40px",
        fontFamily: "var(--font-primary, gg sans, sans-serif)",
    });

    const header = document.createElement("div");
    header.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <span style="font-size:28px;font-weight:700;color:var(--text-normal, #f2f3f5)">⚡ Sycord</span>
            <span style="font-size:13px;color:var(--text-muted, #949ba4)">v${SYCORD_VERSION}</span>
            <button id="sycord-close-btn"
                style="margin-left:auto;background:var(--button-danger-background, #da373c);color:#fff;border:none;
                       padding:6px 14px;border-radius:3px;cursor:pointer;font-size:14px;">
                Close
            </button>
        </div>
        <div style="color:var(--text-muted, #949ba4);margin-bottom:20px;font-size:13px;">
            ${plugins.length} plugins loaded &nbsp;|&nbsp; ${enabledCount} enabled
        </div>
    `;

    const list = document.createElement("div");
    for (const plugin of plugins) {
        list.appendChild(renderPluginRow(plugin));
    }

    overlay.appendChild(header);
    overlay.appendChild(list);
    document.body.appendChild(overlay);

    header.querySelector("#sycord-close-btn")?.addEventListener("click", closeSycordPanel);
    document.addEventListener("keydown", onPanelKeyDown);
}

function renderPluginRow(plugin: ReturnType<typeof getAllPlugins>[number]): HTMLElement {
    const enabled = isPluginEnabled(plugin.name);
    const locked  = !!plugin.required;

    const row = document.createElement("div");
    Object.assign(row.style, {
        display:      "flex",
        alignItems:   "center",
        padding:      "12px 16px",
        marginBottom: "8px",
        background:   "var(--background-secondary, #2b2d31)",
        borderRadius: "8px",
        gap:          "12px",
    });

    const info = document.createElement("div");
    info.style.flex = "1";
    info.innerHTML = `
        <div style="font-weight:600;font-size:14px;">
            ${escapeHtml(plugin.name)}
            ${locked ? '<span style="font-size:11px;color:var(--text-muted, #949ba4);margin-left:6px;">[required]</span>' : ""}
            ${plugin.source ? `<span style="font-size:10px;color:var(--text-muted, #949ba4);margin-left:6px;">[${escapeHtml(plugin.source)}]</span>` : ""}
        </div>
        <div style="font-size:12px;color:var(--text-muted, #949ba4);margin-top:2px;">
            ${escapeHtml(plugin.description)}
        </div>
        <div style="font-size:11px;color:var(--text-muted, #80848e);margin-top:2px;">
            ${plugin.authors.map(a => escapeHtml(a.name)).join(", ")}
            ${plugin.tags?.length ? " · " + plugin.tags.map(escapeHtml).join(", ") : ""}
        </div>
    `;

    const toggle = document.createElement("label");
    Object.assign(toggle.style, {
        position: "relative",
        display:  "inline-block",
        width:    "36px",
        height:   "20px",
        flexShrink: "0",
    });

    const input = document.createElement("input");
    input.type    = "checkbox";
    input.checked = enabled;
    input.disabled = locked;
    Object.assign(input.style, { opacity: "0", width: "0", height: "0" });

    const slider = document.createElement("span");
    Object.assign(slider.style, {
        position:     "absolute",
        cursor:       locked ? "not-allowed" : "pointer",
        top: "0", left: "0", right: "0", bottom: "0",
        background:   enabled ? "#23a55a" : "var(--background-modifier-selected, #4e5058)",
        borderRadius: "20px",
        transition:   ".2s",
        opacity:      locked ? "0.5" : "1",
    });

    const knob = document.createElement("span");
    Object.assign(knob.style, {
        position:     "absolute",
        height:       "14px",
        width:        "14px",
        left:         enabled ? "18px" : "3px",
        bottom:       "3px",
        background:   "white",
        borderRadius: "50%",
        transition:   ".2s",
    });
    slider.appendChild(knob);

    input.addEventListener("change", () => {
        const on = input.checked;
        setPluginEnabled(plugin.name, on);
        slider.style.background = on ? "#23a55a" : "var(--background-modifier-selected, #4e5058)";
        knob.style.left         = on ? "18px" : "3px";
    });

    toggle.appendChild(input);
    toggle.appendChild(slider);
    row.appendChild(info);
    row.appendChild(toggle);
    return row;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]!));
}

// ── Plugin ───────────────────────────────────────────────────────────────────
let _subscribed = false;

registerPlugin(definePlugin({
    name:        "SycordSettings",
    description: "Injects the Sycord configuration panel into Discord's Settings.",
    authors:     [{ name: "Sycord Core" }],
    required:    true,
    source:      "Sycord",
    category:    "Core",

    // No declarative patches — see file header for why.

    start() {
        // Subscribe to settings modal open. If FluxDispatcher isn't ready,
        // this returns false and we just skip the auto-injection; the user
        // can still open the panel via the exposed debug API.
        if (!_subscribed) {
            _subscribed = safeSubscribe("USER_SETTINGS_MODAL_OPEN", () => {
                setTimeout(injectSidebarEntry, 100);
            });
        }

        // Also try once immediately in case settings is already open
        setTimeout(injectSidebarEntry, 500);

        // Expose debug hooks so you can open the panel from DevTools
        (window as any).__sycordOpenPanel = openSycordPanel;
        (window as any).__sycordInjectEntry = injectSidebarEntry;
    },

    stop() {
        removeExistingEntry();
        closeSycordPanel();
    },
}));