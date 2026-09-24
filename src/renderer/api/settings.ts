/**
 * Sycord Settings API
 *
 * Two-layer store:
 *   - In-renderer: localStorage (fast reads, survives reload)
 *   - Cross-session: IPC to main process → disk (userData/Sycord/settings.json)
 *
 * Plugins receive a typed sub-store via definePluginSettings().
 * The store is a Proxy — reading a key returns the value OR its default.
 */

const STORAGE_KEY = "SycordSettings_v1";

// ── Raw disk persistence via IPC ──────────────────────────────────────────────
let _ipc: any = null;

async function getIpc() {
    if (_ipc) return _ipc;
    try {
        // ipcRenderer is available if contextIsolation = false (which we set in injector)
        const { ipcRenderer } = require("electron");
        _ipc = ipcRenderer;
    } catch { /* web build — no IPC */ }
    return _ipc;
}

async function loadFromDisk(): Promise<Record<string, unknown>> {
    const ipc = await getIpc();
    if (!ipc) return {};
    try {
        return await ipc.invoke("SYCORD_GET_SETTINGS") ?? {};
    } catch { return {}; }
}

async function saveToDisk(data: Record<string, unknown>) {
    const ipc = await getIpc();
    if (!ipc) return;
    try { await ipc.invoke("SYCORD_SET_SETTINGS", data); } catch { }
}

// ── In-memory + localStorage store ───────────────────────────────────────────
let _store: Record<string, unknown> = {};

function readLocal(): Record<string, unknown> {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch { return {}; }
}

function writeLocal(data: Record<string, unknown>) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { }
}

/** Initialize settings (called once at renderer startup) */
export async function initSettings() {
    const disk  = await loadFromDisk();
    const local = readLocal();
    // Merge: disk takes priority (in case main process wrote something)
    _store = { ...local, ...disk };
    writeLocal(_store);
}

// ── Public get/set ────────────────────────────────────────────────────────────
export function getSetting<T = unknown>(key: string, defaultValue?: T): T {
    return (_store[key] ?? defaultValue) as T;
}

export function setSetting(key: string, value: unknown) {
    _store[key] = value;
    writeLocal(_store);
    // Async flush to disk — fire and forget
    saveToDisk(_store);
}

export function deleteSetting(key: string) {
    delete _store[key];
    writeLocal(_store);
    saveToDisk(_store);
}

export function getAllSettings(): Record<string, unknown> {
    return { ..._store };
}

// ── Plugin sub-store ──────────────────────────────────────────────────────────
export type SettingsDef = Record<string, {
    type: "boolean" | "number" | "string" | "select";
    default: unknown;
    description: string;
    options?: Array<{ label: string; value: unknown }>;
}>;

export type PluginSettings<D extends SettingsDef> = {
    [K in keyof D]: D[K]["default"];
} & {
    _store: D;
};

export function definePluginSettings<D extends SettingsDef>(
    pluginName: string,
    def: D
): PluginSettings<D> {
    const prefix = `plugin_${pluginName}_`;

    return new Proxy({} as PluginSettings<D>, {
        get(_, prop: string) {
            if (prop === "_store") return def;
            if (prop in def) {
                return getSetting(`${prefix}${prop}`, def[prop as keyof D].default);
            }
            return undefined;
        },
        set(_, prop: string, value) {
            if (prop in def) {
                setSetting(`${prefix}${prop}`, value);
                return true;
            }
            return false;
        },
    }) as PluginSettings<D>;
}
