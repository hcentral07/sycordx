/**
 * Sycord Plugin System
 *
 * Merged model from:
 *   Vencord  — patches[], start/stop, definePlugin()
 *   Equicord — extra metadata (tags, category)
 *   Replugged— settings schema, coexists field, required deps
 *
 * Plugin authors define their plugin with definePlugin() and
 * it's auto-imported by the glob in this file.
 *
 * User plugins go in src/plugins/userplugins/ — same API, never shipped.
 */

import { Patch, registerPatch } from "../renderer/patcher";
import { getSetting, setSetting, definePluginSettings, type SettingsDef } from "@api/settings";

// ── Plugin interface ──────────────────────────────────────────────────────────
export type PluginTag =
    | "Chat"       | "Voice"       | "Server"      | "Appearance"
    | "Privacy"    | "Fun"         | "Utility"      | "Developer"
    | "Nitro"      | "Accessibility"| "Moderation"  | "Integration";

export type PluginCategory =
    | "Core" | "Community" | "UserPlugin";

export interface PluginAuthor {
    name: string;
    id?: string;        // Discord user ID for badge linking
    github?: string;
}

export interface Plugin {
    name:          string;
    description:   string;
    authors:       PluginAuthor[];
    tags?:         PluginTag[];
    category?:     PluginCategory;

    /** Patch array — applied at module load time */
    patches?:      Patch[];

    /** Runs once webpack is ready and plugin is enabled */
    start?():      void | Promise<void>;

    /** Cleanup — runs when plugin is disabled at runtime */
    stop?():       void;

    /** Settings schema (Replugged-inspired typed settings) */
    settingsDef?:  SettingsDef;

    /** Resolved settings proxy — set by startPlugins() */
    settings?:     any;

    /** Other plugin names this plugin requires */
    dependencies?: string[];

    /** If true, cannot be disabled by user */
    required?:     boolean;

    /** React component rendered in the Sycord settings panel */
    settingsComponent?: React.ComponentType<{ plugin: Plugin }>;

    /** Source mod attribution — where the plugin idea/code came from */
    source?: "Vencord" | "Equicord" | "Replugged" | "Sycord" | "UserPlugin";
}

// ── Registry ──────────────────────────────────────────────────────────────────
const registry = new Map<string, Plugin>();

export function definePlugin(plugin: Plugin): Plugin {
    return plugin;
}

export function registerPlugin(plugin: Plugin) {
    if (registry.has(plugin.name)) {
        console.warn(`[Sycord/Plugins] Duplicate plugin name: "${plugin.name}" — skipping`);
        return;
    }

    registry.set(plugin.name, plugin);

    // Register patches immediately (before webpack finishes loading)
    if (plugin.patches?.length) {
        for (const patch of plugin.patches) {
            registerPatch({ ...patch, plugin: plugin.name });
        }
    }

    // Attach typed settings proxy
    if (plugin.settingsDef) {
        plugin.settings = definePluginSettings(plugin.name, plugin.settingsDef);
    }
}

export function getPlugin(name: string): Plugin | undefined {
    return registry.get(name);
}

export function getAllPlugins(): Plugin[] {
    return [...registry.values()];
}

// ── Enable/disable state ──────────────────────────────────────────────────────
export function isPluginEnabled(name: string): boolean {
    const plugin = registry.get(name);
    if (!plugin) return false;
    if (plugin.required) return true;
    return getSetting<boolean>(`enabled_${name}`, false);
}

export function setPluginEnabled(name: string, enabled: boolean) {
    setSetting(`enabled_${name}`, enabled);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
export async function startPlugins() {
    // Resolve dependency order (simple topological sort)
    const ordered = resolveDependencyOrder([...registry.values()]);

    for (const plugin of ordered) {
        if (!isPluginEnabled(plugin.name) && !plugin.required) continue;

        // Check deps
        if (plugin.dependencies?.some(dep => !isPluginEnabled(dep))) {
            console.warn(`[Sycord/Plugins] "${plugin.name}" skipped: missing dependencies ${plugin.dependencies?.join(", ")}`);
            continue;
        }

        try {
            await plugin.start?.();
            console.log(`[Sycord/Plugins] ✅ ${plugin.name} started`);
        } catch (e) {
            console.error(`[Sycord/Plugins] ❌ "${plugin.name}" threw on start:`, e);
        }
    }
}

export function stopPlugins() {
    for (const plugin of registry.values()) {
        try { plugin.stop?.(); } catch { }
    }
}

function resolveDependencyOrder(plugins: Plugin[]): Plugin[] {
    const visited  = new Set<string>();
    const result:  Plugin[] = [];

    function visit(plugin: Plugin) {
        if (visited.has(plugin.name)) return;
        visited.add(plugin.name);
        for (const dep of plugin.dependencies ?? []) {
            const depPlugin = registry.get(dep);
            if (depPlugin) visit(depPlugin);
        }
        result.push(plugin);
    }

    plugins.forEach(visit);
    return result;
}

// ── Auto-register all plugins ─────────────────────────────────────────────────
// Core (always-on)
import "./core/noTrack";
import "./core/experiments";
import "./core/settings";

// Community plugins
import "./community/freeEmotes";
import "./community/messageLogger";
import "./community/betterRoleColors";
import "./community/showHiddenChannels";
import "./community/whoReacted";
import "./community/spotifyControls";
import "./community/noTypingIndicator";
import "./community/timestampOverride";

// User plugins (your personal additions)
// Drop any .ts files into src/plugins/userplugins/ — they're loaded here
// via the glob pattern in the build step
