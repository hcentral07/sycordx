# ⚡ Sycord

> The Discord client mod that hits different.

Sycord is a from-scratch Discord desktop client mod that pulls the best DNA from **Vencord**, **Equicord**, and **Replugged** into one clean, hackable codebase — built to be *yours*.

---

## Features

- **300+ plugins** — starting base from Equicord's catalogue + Sycord originals
- **Mixed architecture** — Vencord's patch system, Equicord's plugin set, Replugged's typed settings
- **User plugins** — drop your `.ts` into `src/plugins/userplugins/` and they just work
- **Privacy first** — NoTrack kills ALL analytics, Science, Sentry on boot
- **QuickCSS** — live CSS editor, BetterDiscord theme `@import` support
- **Full webpack API** — `findByProps`, `findByCode`, `mapMangledModule`, `bulk`, `waitFor`
- **Typed settings** — per-plugin settings with schema validation
- **Windows / macOS / Linux** — universal injector

---

## Install (Dev Build)

### Requirements
- [Node.js LTS](https://nodejs.org) (≥18)
- [pnpm](https://pnpm.io) (`npm i -g pnpm`)
- [Git](https://git-scm.com)

```bash
git clone https://github.com/hcentral07/sycord
cd sycord
pnpm install
pnpm build
pnpm inject
# → Restart Discord
```

### Uninstall
```bash
pnpm uninject
# or:
node scripts/inject.mjs --uninject
```

---

## Writing a Plugin

Drop a `.ts` file into `src/plugins/userplugins/`:

```typescript
import { definePlugin, registerPlugin } from "@plugins";
import { findByProps } from "@webpack";

registerPlugin(definePlugin({
    name:        "MyPlugin",
    description: "Does cool things.",
    authors:     [{ name: "Me", github: "mygithub" }],
    tags:        ["Utility"],

    start() {
        const SomeModule = findByProps("someMethod");
        console.log("Plugin running!", SomeModule);
    },

    stop() { /* cleanup */ },
}));
```

See `src/plugins/userplugins/EXAMPLE_PLUGIN.ts` for the full API.

---

## Webpack API Quick Reference

```typescript
import { findByProps, findByCode, findByDisplayName, waitFor, bulk } from "@webpack";
import { FluxDispatcher, MessageActions, UserStore } from "@webpack/common";

// Sync finders
const mod   = findByProps("sendMessage", "editMessage");
const comp  = findByCode("renderUsername", "getGuildMember");
const store = findByDisplayName("UserStore");

// Async
const ready = await waitFor(m => m?.getCurrentUser);

// Multi-find in ONE O(n) pass
const [msgMod, emojiMod] = bulk(
    m => m?.sendMessage,
    m => m?.getEmojiUnavailableReason,
);
```

---

## Project Structure

```
sycord/
├── src/
│   ├── main/            Electron main process + IPC
│   ├── preload/         Preload script (Node→renderer bridge)
│   ├── renderer/
│   │   ├── patcher.ts   Webpack chunk interceptor + regex patcher
│   │   ├── webpack/     Module finder system
│   │   ├── api/         Settings, Styles, Notifications APIs
│   │   └── index.ts     Renderer bootstrap
│   └── plugins/
│       ├── index.ts     Plugin registry + lifecycle
│       ├── core/        Always-on core plugins
│       ├── community/   Opt-in community plugins
│       └── userplugins/ YOUR plugins (never shipped)
└── scripts/
    ├── build.mjs        esbuild pipeline
    └── inject.mjs       Discord patcher / uninjector
```

---

## Credits

- [Vendicated](https://github.com/Vendicated) — Vencord (GPL-3.0)
- [Equicord Team](https://github.com/Equicord) — Equicord (GPL-3.0)
- [Replugged Team](https://github.com/replugged-org) — Replugged architecture ideas
- You — for making it yours

---

## License

GPL-3.0-or-later — same as Vencord/Equicord upstream.

**Using Sycord violates Discord's ToS. Your account, your risk.**
