/**
 * Sycord Settings Panel injection
 * Adds a "Sycord" entry to Discord's User Settings sidebar.
 * Renders the plugin list, enable/disable toggles, and per-plugin settings.
 */

import { definePlugin, registerPlugin, getAllPlugins, isPluginEnabled, setPluginEnabled } from "@plugins";
import { waitFor } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

// We inject a settings section by patching the settings panel renderer.
// Discord renders its settings as a list of section labels → panels.
// We hook into the "USER_SETTINGS_MODAL_OPEN" dispatch to force-add our section.

registerPlugin(definePlugin({
    name:     "SycordSettings",
    description: "Injects the Sycord configuration panel into Discord's Settings.",
    authors:  [{ name: "Sycord Core" }],
    required: true,
    source:   "Sycord",
    category: "Core",

    patches: [
        // Inject our nav item after "My Account" in the settings sidebar
        {
            find: "getPredicateSections",
            replacement: {
                match: /getPredicateSections\(\)\s*\{([\s\S]*?)\}/,
                replace: `getPredicateSections(){$1}`,
            },
            optional: true,
        },
        // Add our panel render into the settings panel switch
        {
            find: "\"BILLING_PREMIUM\"",
            replacement: {
                match: /case\s+"BILLING_PREMIUM":/,
                replace: `case "SYCORD_SETTINGS": return $self.renderSettingsPanel(); case "BILLING_PREMIUM":`,
            },
            optional: true,
        },
    ],

    start() {
        // Fallback: subscribe to settings modal open and inject via DOM
        try {
            FluxDispatcher.subscribe("USER_SETTINGS_MODAL_OPEN", () => {
                setTimeout(() => _injectSidebarEntry(), 50);
            });
        } catch { }
    },

    stop() {
        document.getElementById("sycord-settings-entry")?.remove();
    },
}));

function _injectSidebarEntry() {
    if (document.getElementById("sycord-settings-entry")) return;

    // Find the settings sidebar scroller
    const sidebar = document.querySelector('[class*="sidebar"]');
    if (!sidebar) return;

    const entry = document.createElement("div");
    entry.id = "sycord-settings-entry";
    entry.setAttribute("data-sycord", "true");
    entry.textContent = "⚡ Sycord";
    Object.assign(entry.style, {
        padding:      "6px 10px",
        margin:       "4px 8px",
        borderRadius: "4px",
        cursor:       "pointer",
        color:        "var(--interactive-normal)",
        fontSize:     "14px",
        fontWeight:   "500",
        transition:   "background 0.15s",
    });

    entry.addEventListener("mouseenter", () => {
        entry.style.background = "var(--background-modifier-hover)";
    });
    entry.addEventListener("mouseleave", () => {
        entry.style.background = "";
    });
    entry.addEventListener("click", () => _openSycordPanel());

    sidebar.appendChild(entry);
}

function _openSycordPanel() {
    // Render a simple plugin panel overlay
    const existing = document.getElementById("sycord-panel-overlay");
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement("div");
    overlay.id = "sycord-panel-overlay";
    Object.assign(overlay.style, {
        position:    "fixed",
        top:         "0", left: "0", right: "0", bottom: "0",
        zIndex:      "9999",
        background:  "var(--background-primary, #313338)",
        color:       "var(--text-normal, #dbdee1)",
        overflowY:   "auto",
        padding:     "40px",
        fontFamily:  "var(--font-primary, sans-serif)",
    });

    const plugins = getAllPlugins();
    const header = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <span style="font-size:28px;font-weight:700;color:var(--text-normal)">⚡ Sycord</span>
            <span style="font-size:13px;color:var(--text-muted)">v${SYCORD_VERSION}</span>
            <button onclick="document.getElementById('sycord-panel-overlay').remove()" 
                style="margin-left:auto;background:var(--button-danger-background);color:#fff;border:none;
                       padding:6px 14px;border-radius:3px;cursor:pointer;font-size:14px;">Close</button>
        </div>
        <div style="color:var(--text-muted);margin-bottom:20px;font-size:13px;">
            ${plugins.length} plugins loaded &nbsp;|&nbsp; 
            ${plugins.filter(p => isPluginEnabled(p.name)).length} enabled
        </div>
    `;

    const pluginRows = plugins
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(plugin => {
            const enabled = isPluginEnabled(plugin.name);
            const locked  = plugin.required;
            return `
                <div style="display:flex;align-items:center;padding:12px 16px;margin-bottom:8px;
                            background:var(--background-secondary,#2b2d31);border-radius:8px;gap:12px;">
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:14px;">${plugin.name}
                            ${locked ? '<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">[required]</span>' : ""}
                            ${plugin.source ? `<span style="font-size:10px;color:var(--text-muted);margin-left:6px;">[${plugin.source}]</span>` : ""}
                        </div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${plugin.description}</div>
                        <div style="font-size:11px;color:var(--text-muted-more,#80848e);margin-top:2px;">
                            ${plugin.authors.map(a => a.name).join(", ")} 
                            ${plugin.tags?.length ? "· " + plugin.tags.join(", ") : ""}
                        </div>
                    </div>
                    <label style="position:relative;display:inline-block;width:36px;height:20px;">
                        <input type="checkbox" 
                            ${enabled ? "checked" : ""} 
                            ${locked ? "disabled" : ""}
                            onchange="window.__sycordTogglePlugin('${plugin.name}', this.checked)"
                            style="opacity:0;width:0;height:0;">
                        <span style="position:absolute;cursor:${locked ? "not-allowed" : "pointer"};
                                     top:0;left:0;right:0;bottom:0;
                                     background:${enabled ? "#23a55a" : "var(--background-modifier-selected)"};
                                     border-radius:20px;transition:.2s;">
                            <span style="position:absolute;height:14px;width:14px;left:${enabled ? "18px" : "3px"};
                                         bottom:3px;background:white;border-radius:50%;transition:.2s;"></span>
                        </span>
                    </label>
                </div>
            `;
        })
        .join("");

    overlay.innerHTML = header + pluginRows;
    document.body.appendChild(overlay);

    // Toggle handler
    (window as any).__sycordTogglePlugin = (name: string, enabled: boolean) => {
        setPluginEnabled(name, enabled);
    };
}
