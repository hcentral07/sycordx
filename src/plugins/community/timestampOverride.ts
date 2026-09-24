/**
 * TimestampOverride — Sycord Community Plugin
 * Forces all message timestamps to show the full date+time instead of
 * Discord's relative "Today at 3:42 PM" format.
 */
import { definePlugin, registerPlugin } from "@plugins";

registerPlugin(definePlugin({
    name:        "TimestampOverride",
    description: 'Shows full "YYYY-MM-DD HH:mm:ss" timestamps instead of relative "Today at X".',
    authors:     [{ name: "Sycord" }],
    tags:        ["Chat", "Utility"],
    category:    "Community",
    source:      "Sycord",

    patches: [
        {
            find: "calendarFormat",
            replacement: {
                match: /calendarFormat\([^)]+\)/g,
                replace: `$self.fullTimestamp(arguments[0])`,
            },
            optional: true,
        },
    ],

    start() {
        (window as any).__SycordTS = {
            fullTimestamp(date: Date | number): string {
                const d = new Date(date);
                return d.toISOString().replace("T", " ").slice(0, 19);
            },
        };
        console.log("[TimestampOverride] Full timestamps enabled ✅");
    },

    stop() {
        delete (window as any).__SycordTS;
    },
}));
