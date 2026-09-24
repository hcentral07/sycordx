/**
 * Sycord Main Process
 * Handles IPC from renderer, update checking, settings persistence on disk.
 */

import { app, ipcMain, shell, BrowserWindow } from "electron";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

// ── Settings persistence ──────────────────────────────────────────────────────
const SETTINGS_DIR  = join(app.getPath("userData"), "Sycord");
const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json");

if (!existsSync(SETTINGS_DIR)) mkdirSync(SETTINGS_DIR, { recursive: true });

function readSettings(): Record<string, unknown> {
    try {
        return JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
    } catch {
        return {};
    }
}

function writeSettings(data: Record<string, unknown>) {
    writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle("SYCORD_GET_SETTINGS", () => readSettings());

ipcMain.handle("SYCORD_SET_SETTINGS", (_event, data: Record<string, unknown>) => {
    writeSettings(data);
    return { ok: true };
});

ipcMain.handle("SYCORD_OPEN_EXTERNAL", (_event, url: string) => {
    // Only allow https:// links
    if (url.startsWith("https://")) shell.openExternal(url);
});

ipcMain.handle("SYCORD_GET_VERSION", () => SYCORD_VERSION);

// ── Devtools shortcut (dev builds only) ───────────────────────────────────────
if (IS_DEV) {
    app.whenReady().then(() => {
        const { globalShortcut } = require("electron");
        globalShortcut.register("F12", () => {
            const win = BrowserWindow.getFocusedWindow();
            win?.webContents.toggleDevTools();
        });
    });
}

console.log(`[Sycord Main] v${SYCORD_VERSION} loaded`);
