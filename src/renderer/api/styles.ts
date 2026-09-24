/**
 * Sycord CSS Injection API
 * Injects, updates, and removes named <style> tags at runtime.
 * Also supports importing BetterDiscord-compatible @import themes.
 */

const STYLE_PREFIX = "sycord-style-";
const injectedStyles = new Set<string>();

export function injectStyle(id: string, css: string) {
    const fullId = STYLE_PREFIX + id;
    let el = document.getElementById(fullId) as HTMLStyleElement | null;

    if (!el) {
        el = document.createElement("style");
        el.id = fullId;
        el.setAttribute("data-sycord", "true");
        document.head.appendChild(el);
        injectedStyles.add(id);
    }

    el.textContent = css;
}

export function removeStyle(id: string) {
    const el = document.getElementById(STYLE_PREFIX + id);
    if (el) {
        el.remove();
        injectedStyles.delete(id);
    }
}

export function updateStyle(id: string, css: string) {
    injectStyle(id, css); // injectStyle already handles updates
}

export function hasStyle(id: string): boolean {
    return injectedStyles.has(id);
}

export function clearAllSycordStyles() {
    for (const id of injectedStyles) {
        removeStyle(id);
    }
}

// ── QuickCSS (user custom CSS, Vencord-style) ─────────────────────────────────
const QUICK_CSS_KEY = "SycordQuickCSS";

export function getQuickCSS(): string {
    return localStorage.getItem(QUICK_CSS_KEY) ?? "";
}

export function setQuickCSS(css: string) {
    localStorage.setItem(QUICK_CSS_KEY, css);
    injectStyle("quickcss", css);
}

export function initQuickCSS() {
    const css = getQuickCSS();
    if (css) injectStyle("quickcss", css);
}

// ── BetterDiscord theme @import ────────────────────────────────────────────────
export function importTheme(url: string) {
    // Validates it's a safe https URL before injecting
    if (!url.startsWith("https://")) {
        console.warn("[Sycord/Styles] Rejected non-https theme URL:", url);
        return;
    }
    const id = "theme-" + btoa(url).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
    injectStyle(id, `@import url("${url}");`);
}
