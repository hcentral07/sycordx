/**
 * Sycord Notifications API
 * Wraps Discord's native toast/notice system.
 * Falls back to a custom DOM toast if Discord's isn't loaded yet.
 */

import { findByPropsLazy } from "@webpack";

const DiscordToasts = findByPropsLazy("show", "pop", "ToastType");

export const enum ToastType {
    Success = 1,
    Failure = 2,
    Warning = 3,
    Info    = 0,
}

interface ToastOptions {
    type?:      ToastType;
    duration?:  number;
    position?:  "top" | "bottom";
}

export function showToast(message: string, options: ToastOptions = {}) {
    const { type = ToastType.Info, duration = 3000 } = options;

    try {
        const toastId = DiscordToasts?.create?.({ message, type });
        if (toastId) {
            DiscordToasts.show(toastId);
            setTimeout(() => DiscordToasts?.pop?.(toastId), duration);
            return;
        }
    } catch { /* Discord toasts not ready */ }

    // Fallback: minimal DOM toast
    _domToast(message, type, duration);
}

function _domToast(message: string, type: ToastType, duration: number) {
    const colors: Record<ToastType, string> = {
        [ToastType.Success]: "#23a55a",
        [ToastType.Failure]: "#f23f43",
        [ToastType.Warning]: "#e67e22",
        [ToastType.Info]:    "#5865f2",
    };

    const el = Object.assign(document.createElement("div"), {
        textContent: `[Sycord] ${message}`,
    });

    Object.assign(el.style, {
        position:     "fixed",
        bottom:       "20px",
        right:        "20px",
        zIndex:       "99999",
        background:   colors[type] ?? colors[ToastType.Info],
        color:        "#fff",
        padding:      "8px 16px",
        borderRadius: "4px",
        fontFamily:   "var(--font-primary, sans-serif)",
        fontSize:     "14px",
        boxShadow:    "0 2px 10px rgba(0,0,0,.4)",
        transition:   "opacity 0.3s ease",
        opacity:      "1",
    });

    document.body.appendChild(el);
    setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 300);
    }, duration);
}

// ── Notice bar (top of screen, Vencord-style) ─────────────────────────────────
const DiscordNotices = findByPropsLazy("notice", "NoticeTypes");

export function showNotice(message: string, onClick?: () => void) {
    try {
        DiscordNotices?.notice?.({ message, onClick });
    } catch { }
}
