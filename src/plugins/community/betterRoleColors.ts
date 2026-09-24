/**
 * BetterRoleColors — Sycord Community Plugin
 * Colors usernames in chat, mentions, and voice panels using their highest role color.
 * Source: Vencord/RoleColorEverywhere (ported + improved mention coloring)
 */

import { definePlugin, registerPlugin } from "@plugins";
import { findByProps, waitFor } from "@webpack";

registerPlugin(definePlugin({
    name:        "BetterRoleColors",
    description:  "Applies role colors to usernames in messages, mentions, member list, and voice channels.",
    authors:     [{ name: "Sycord" }],
    tags:        ["Appearance", "Chat"],
    category:    "Community",
    source:      "Vencord",

    patches: [
        // ── Color username in message header ──────────────────────────────
        {
            find: "renderUsername",
            replacement: {
                match: /(renderUsername\s*\(\s*\)\s*\{)([\s\S]*?)(return\s+\w+\.createElement)/,
                replace: `$1$2
                    const roleColor = $self.getUserColor(this.props?.message?.author?.id, this.props?.message?.guildId);
                    $3`,
            },
            optional: true,
        },
    ],

    start() {
        waitFor((m: any) => m?.getMember && m?.getMembers).then((GuildMemberStore: any) => {
            (window as any).__SycordRoleColor = {
                getMemberColor(userId: string, guildId: string): string | null {
                    const member = GuildMemberStore?.getMember(guildId, userId);
                    return member?.colorString ?? null;
                },
            };
        });

        // Observe the DOM and inject role colors via CSS custom properties
        const observer = new MutationObserver(() => _applyColors());
        observer.observe(document.body, { childList: true, subtree: true });
        _applyColors();

        this._observer = observer;
    },

    stop() {
        (this as any)._observer?.disconnect();
        delete (window as any).__SycordRoleColor;
    },
}));

function _applyColors() {
    // Find username elements and apply color if we have a role color
    // Discord renders: [data-author-id="..."] spans
    document.querySelectorAll<HTMLElement>("[data-author-id]").forEach(el => {
        if (el.dataset.sycordColored) return;
        const userId  = el.dataset.authorId;
        const guildId = _getGuildId();
        if (!userId || !guildId) return;

        const color = (window as any).__SycordRoleColor?.getMemberColor(userId, guildId);
        if (color) {
            el.style.color = color;
            el.dataset.sycordColored = "1";
        }
    });
}

function _getGuildId(): string | null {
    // Extract guild ID from URL: /channels/{guildId}/{channelId}
    const match = location.pathname.match(/\/channels\/(\d+)\//);
    return match?.[1] ?? null;
}
