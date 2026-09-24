/**
 * Sycord Build System
 * esbuild-based, three-target pipeline:
 *   - main    → Node/Electron main process
 *   - preload → Node + partial browser (Electron preload)
 *   - renderer → pure Chromium bundle (injected into Discord's renderer)
 * Optional: --web builds browser extension ZIPs
 */

import esbuild from "esbuild";
import { argv, exit } from "process";
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const watch  = argv.includes("--watch");
const web    = argv.includes("--web");
const isProd = !watch;

const ROOT = resolve(".");
const DIST = join(ROOT, "dist");

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

// ── Shared esbuild options ────────────────────────────────────────────────────
const common = {
    bundle:    true,
    minify:    isProd,
    sourcemap: watch ? "inline" : false,
    logLevel:  "info",
    treeShaking: true,
    define: {
        "SYCORD_VERSION":  JSON.stringify("1.0.0"),
        "IS_DEV":          JSON.stringify(!isProd),
        "IS_WEB":          JSON.stringify(web),
        "IS_DISCORD_DESKTOP": JSON.stringify(!web),
    },
};

// Node builtins that must never be bundled into the renderer.
// esbuild needs these marked external so it doesn't try to resolve them
// from the browser platform's module graph.
const NODE_BUILTINS = [
    "fs", "path", "os", "crypto", "stream", "util", "events",
    "child_process", "url", "http", "https", "net", "tls", "zlib",
    "module", "worker_threads", "assert", "buffer", "process",
];

async function buildTarget(opts) {
    const ctx = await esbuild.context({ ...common, ...opts });
    if (watch) {
        await ctx.watch();
        console.log(`👁  Watching: ${opts.outfile ?? opts.outdir}`);
    } else {
        await ctx.rebuild();
        ctx.dispose();
    }
}

// ── Main process ──────────────────────────────────────────────────────────────
if (!web) {
    await buildTarget({
        entryPoints: ["src/main/index.ts"],
        outfile:     "dist/main.js",
        platform:    "node",
        target:      "node20",
        external:    ["electron", "electron/*"],
    });

    // ── Preload ───────────────────────────────────────────────────────────────
    await buildTarget({
        entryPoints: ["src/preload/index.ts"],
        outfile:     "dist/preload.js",
        platform:    "node",
        target:      "node20",
        external:    ["electron", "electron/*"],
    });
}

// ── Renderer (shared between desktop and web) ─────────────────────────────────
await buildTarget({
    entryPoints: ["src/renderer/index.ts"],
    outfile:     web ? "dist/extension/renderer.js" : "dist/renderer.js",
    platform:    "browser",
    target:      "chrome120",
    tsconfig:    "tsconfig.json",
    // If the renderer graph accidentally pulls in electron or node builtins,
    // treat them as external instead of failing the build. The renderer
    // runs inside Discord's page — it can never actually use these, so if
    // any are hit at runtime, that's a real bug to fix in the source.
    external:    ["electron", "electron/*", ...NODE_BUILTINS],
    define: {
        ...common.define,
        "process.env.NODE_ENV": JSON.stringify(isProd ? "production" : "development"),
    },
});

// ── Web extension manifest ────────────────────────────────────────────────────
if (web) {
    if (!existsSync("dist/extension")) mkdirSync("dist/extension", { recursive: true });

    const manifest = {
        manifest_version: 3,
        name: "Sycord",
        version: "1.0.0",
        description: "Sycord — the Discord client mod that hits different",
        permissions: ["storage", "tabs"],
        host_permissions: ["https://discord.com/*", "https://ptb.discord.com/*", "https://canary.discord.com/*"],
        content_scripts: [{
            js: ["renderer.js"],
            matches: ["https://discord.com/*", "https://ptb.discord.com/*", "https://canary.discord.com/*"],
            run_at: "document_start",
        }],
        icons: { 48: "icon.png", 128: "icon.png" },
    };

    writeFileSync("dist/extension/manifest.json", JSON.stringify(manifest, null, 2));

    // copy browser assets
    if (existsSync("browser")) {
        for (const f of readdirSync("browser")) {
            copyFileSync(join("browser", f), join("dist/extension", f));
        }
    }

    // create ZIP
    const { execSync } = await import("child_process");
    try {
        execSync("cd dist/extension && zip -r ../sycord-extension.zip .", { stdio: "inherit" });
        console.log("✅ Web extension ZIP: dist/sycord-extension.zip");
    } catch {
        console.log("⚠  zip not available — extension files at dist/extension/");
    }
}

if (!watch) console.log("✅ Sycord build complete 🔥");