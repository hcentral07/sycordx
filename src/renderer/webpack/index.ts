/**
 * Sycord Webpack Module System
 *
 * Inspired by Vencord's webpack.ts + Equicord's extra finders + Replugged's
 * getByProps/getBySource patterns merged into a single coherent API.
 *
 * Provides:
 *   findModule(filter)         — iterate all cached modules
 *   findByProps(...props)      — find module with all listed property names
 *   findByCode(...snippets)    — find module whose factory source contains snippets
 *   findByDisplayName(name)    — find React component by displayName
 *   findStore(name)            — find a Flux store by name
 *   mapMangledModule(find, map)— extract multiple exports from one obfuscated module
 *   waitFor(filter)            — async, resolves when module appears
 *   findAll(filter)            — returns ALL matching modules
 *   bulk(...filters)           — find several modules in one O(n) pass
 *
 * Lazy variants (suffix "Lazy") return Proxy objects that evaluate on first access.
 */

// ── Internal state ────────────────────────────────────────────────────────────
export type FilterFn = (exports: any, module?: any, id?: string) => boolean;

let _wreq: any = null;
const waitForCallbacks = new Map<FilterFn, Array<(mod: any) => void>>();

/** Called by patcher.ts once webpack's __webpack_require__ is captured */
export function setWebpackRequire(req: any) {
    _wreq = req;

    // Flush pending waitFor callbacks against all already-loaded modules
    for (const [filter, cbs] of waitForCallbacks) {
        const mod = _findModule(filter);
        if (mod) {
            cbs.forEach(cb => cb(mod));
            waitForCallbacks.delete(filter);
        }
    }
}

/** Called by patcher.ts for every module that finishes loading */
export function onModuleLoaded(exports: any) {
    if (!waitForCallbacks.size) return;

    for (const [filter, cbs] of waitForCallbacks) {
        try {
            if (filter(exports)) {
                cbs.forEach(cb => cb(exports));
                waitForCallbacks.delete(filter);
            }
        } catch { /* filter threw — module doesn't match */ }
    }
}

// ── Core iteration ────────────────────────────────────────────────────────────
function* iterModules(): Generator<[string, any]> {
    if (!_wreq?.c) return;
    for (const id in _wreq.c) {
        const mod = _wreq.c[id];
        if (!mod?.exports) continue;
        yield [id, mod.exports];
    }
}

function _findModule(filter: FilterFn, all = false): any {
    const results: any[] = [];

    for (const [id, exp] of iterModules()) {
        // Direct exports object
        try { if (filter(exp, undefined, id)) { if (!all) return exp; results.push(exp); } } catch { }
        // .default (ESM)
        if (exp?.default) {
            try { if (filter(exp.default, undefined, id)) { if (!all) return exp.default; results.push(exp.default); } } catch { }
        }
        // Named exports
        if (typeof exp === "object" && exp !== null) {
            for (const key of Object.keys(exp)) {
                const val = exp[key];
                if (!val || val === exp) continue;
                try { if (filter(val, undefined, id)) { if (!all) return val; results.push(val); } } catch { }
            }
        }
    }

    return all ? results : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Low-level: find first module satisfying filter */
export function findModule(filter: FilterFn): any | null {
    return _findModule(filter, false);
}

/** Find ALL modules satisfying filter */
export function findAll(filter: FilterFn): any[] {
    return _findModule(filter, true) as any[];
}

/** Find module that has ALL listed property names */
export function findByProps(...props: string[]): any | null {
    return findModule(m => m && typeof m === "object" && props.every(p => p in m));
}

/** Find by code snippet(s) present in the factory toString */
export function findByCode(...snippets: string[]): any | null {
    return findModule(m => {
        if (typeof m !== "function") return false;
        const src = Function.prototype.toString.call(m);
        return snippets.every(s => src.includes(s));
    });
}

/** Find React component by displayName */
export function findByDisplayName(name: string): any | null {
    return findModule(m => m?.displayName === name || m?.render?.displayName === name);
}

/** Find a Flux store by its internal storeName */
export function findStore(storeName: string): any | null {
    return findModule(m => m?.getName?.() === storeName || m?._dispatchToken && m?.getName?.() === storeName);
}

/**
 * Map multiple exports from ONE obfuscated module.
 * find    = substring to locate the module
 * mappers = { key: filterFn } — each filterFn receives a named export and returns bool
 *
 * Returns { key: exportedValue } for all matched keys.
 * (Vencord-style mapMangledModule)
 */
export function mapMangledModule<T extends Record<string, FilterFn>>(
    find: string,
    mappers: T
): { [K in keyof T]: any } {
    const module = findByCode(find);
    if (!module) return {} as any;

    // module might be the factory source — iterate the parent module's exports
    const result: Record<string, any> = {};

    for (const [key, filter] of Object.entries(mappers)) {
        for (const [, exp] of iterModules()) {
            const src = exp && typeof exp === "object" ? null : Function.prototype.toString.call(exp);
            if (src && !src.includes(find)) continue;
            // walk named exports
            if (exp && typeof exp === "object") {
                for (const k of Object.keys(exp)) {
                    try { if (filter(exp[k])) { result[key] = exp[k]; break; } } catch { }
                }
            }
            if (result[key]) break;
        }
    }

    return result as any;
}

/**
 * Find multiple modules in a SINGLE O(n) pass.
 * Returns array of results in the same order as filters.
 */
export function bulk(...filters: FilterFn[]): (any | null)[] {
    const results: (any | null)[] = new Array(filters.length).fill(null);
    const remaining = new Set(filters.map((_, i) => i));

    for (const [id, exp] of iterModules()) {
        const candidates = [exp, exp?.default, ...(typeof exp === "object" ? Object.values(exp) : [])];

        for (const c of candidates) {
            if (!c) continue;
            for (const i of remaining) {
                try {
                    if (filters[i](c, undefined, id)) {
                        results[i] = c;
                        remaining.delete(i);
                    }
                } catch { }
            }
            if (!remaining.size) return results;
        }
    }

    return results;
}

// ── Async / waitFor ───────────────────────────────────────────────────────────
export function waitFor(filter: FilterFn): Promise<any> {
    const existing = findModule(filter);
    if (existing) return Promise.resolve(existing);

    return new Promise(resolve => {
        const cbs = waitForCallbacks.get(filter) ?? [];
        cbs.push(resolve);
        waitForCallbacks.set(filter, cbs);
    });
}

// ── Lazy proxy helpers ────────────────────────────────────────────────────────
function proxyLazy<T extends object>(factory: () => T | null, name = "unknown"): T {
    let cache: T | null = null;
    let accessed = false;

    return new Proxy({} as T, {
        get(_, prop) {
            if (!accessed) { accessed = true; cache = factory(); }
            if (!cache) {
                if (IS_DEV) console.error(`[Sycord/webpack] proxyLazy (${name}) not resolved at access of prop "${String(prop)}"`);
                return undefined;
            }
            const val = (cache as any)[prop];
            return typeof val === "function" ? val.bind(cache) : val;
        },
        set(_, prop, value) {
            if (!cache) cache = factory();
            if (cache) (cache as any)[prop] = value;
            return true;
        },
        has(_, prop) {
            if (!cache) cache = factory();
            return cache ? prop in cache : false;
        },
    });
}

export function findByPropsLazy(...props: string[])     { return proxyLazy(() => findByProps(...props),     props.join(",")); }
export function findByCodeLazy(...snippets: string[])   { return proxyLazy(() => findByCode(...snippets),   snippets[0]); }
export function findByDisplayNameLazy(name: string)     { return proxyLazy(() => findByDisplayName(name),  name); }
export function findStoreLazy(name: string)             { return proxyLazy(() => findStore(name),          name); }

// ── Dev exposure ──────────────────────────────────────────────────────────────
if (IS_DEV) {
    (window as any).__SycordWebpack = {
        findModule, findAll, findByProps, findByCode,
        findByDisplayName, findStore, mapMangledModule, bulk, waitFor,
        get wreq() { return _wreq; },
    };
}
