// @module-federation/vite resolves some shared packages with require.resolve(), which on Windows
// returns `C:\…\react\index.js`. The bundler then loads react a second time next to vite's own
// `C:/…` id, chunks differently than on Linux, and the committed bundle never matches the CI build.

type ResolveIdResult = string | { id: string } | null | undefined | false;
type ResolveIdHandler = (...args: unknown[]) => ResolveIdResult | Promise<ResolveIdResult>;
/** The part of a vite plugin this module touches */
export type ResolvingPlugin = {
    /** Function hook or object hook, both shapes vite accepts */
    resolveId?:
        | ResolveIdHandler
        | {
              /** The hook function of an object hook */
              handler: ResolveIdHandler;
          };
};

/**
 * Write a Windows absolute path with forward slashes, the way vite spells its module ids.
 *
 * @param id - resolved module id
 * @returns the id with forward slashes if it is a Windows absolute path, otherwise unchanged
 */
export const toPosixId = (id: string): string => (/^[A-Za-z]:\\/.test(id) ? id.replace(/\\/g, '/') : id);

/**
 * Wrap the resolveId hook of every plugin so the ids it returns go through {@link toPosixId}.
 *
 * @param plugins - plugins whose resolved ids must be normalized
 * @returns the same plugins with wrapped resolveId hooks
 */
export function withPosixResolvedIds<T extends ResolvingPlugin>(plugins: T[]): T[] {
    return plugins.map(plugin => {
        const hook = plugin.resolveId;
        if (!hook) {
            return plugin;
        }
        const handler = typeof hook === 'function' ? hook : hook.handler;
        const wrapped = async function (this: unknown, ...args: unknown[]): Promise<ResolveIdResult> {
            const result = await handler.apply(this, args);
            if (typeof result === 'string') {
                return toPosixId(result);
            }
            return result && typeof result === 'object' ? { ...result, id: toPosixId(result.id) } : result;
        };
        return { ...plugin, resolveId: typeof hook === 'function' ? wrapped : { ...hook, handler: wrapped } };
    });
}
