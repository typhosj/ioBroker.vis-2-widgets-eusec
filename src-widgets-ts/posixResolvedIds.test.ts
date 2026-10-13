import { describe, expect, it } from 'vitest';

import { type ResolvingPlugin, toPosixId, withPosixResolvedIds } from './posixResolvedIds';

const call = (plugin: ResolvingPlugin): Promise<unknown> =>
    Promise.resolve(typeof plugin.resolveId === 'function' ? plugin.resolveId() : plugin.resolveId?.handler());

const winId = 'C:\\repo\\src-widgets-ts\\node_modules\\react\\index.js';
const posixId = 'C:/repo/src-widgets-ts/node_modules/react/index.js';

describe('toPosixId', () => {
    it('turns a Windows absolute path into the forward-slash id vite uses', () => {
        expect(toPosixId(winId)).toBe(posixId);
        expect(toPosixId('d:\\x.js')).toBe('d:/x.js');
    });

    it('leaves every other id alone', () => {
        expect(toPosixId(posixId)).toBe(posixId);
        expect(toPosixId('/home/runner/react/index.js')).toBe('/home/runner/react/index.js');
        // virtual module ids start with NUL and may carry backslashes that are not path separators
        expect(toPosixId('\0virtual:mf\\react')).toBe('\0virtual:mf\\react');
        expect(toPosixId('react')).toBe('react');
        expect(toPosixId('')).toBe('');
        expect(toPosixId('C:')).toBe('C:');
    });
});

describe('withPosixResolvedIds', () => {
    it('normalizes string and object results of function and object hooks', async () => {
        const plugins: ResolvingPlugin[] = [
            { resolveId: () => winId },
            { resolveId: { handler: () => Promise.resolve({ id: winId, external: false }) } },
            {},
        ];
        const [fn, obj, none] = withPosixResolvedIds(plugins);
        expect(await call(fn)).toBe(posixId);
        expect(await call(obj)).toEqual({ id: posixId, external: false });
        expect(none.resolveId).toBeUndefined();
    });

    it('passes "not resolved" results through unchanged', async () => {
        for (const result of [null, undefined, false] as const) {
            const [plugin] = withPosixResolvedIds<ResolvingPlugin>([{ resolveId: () => result }]);
            expect(await call(plugin)).toBe(result);
        }
    });

    it('keeps the plugin context and the arguments', async () => {
        const [plugin] = withPosixResolvedIds<ResolvingPlugin>([
            {
                resolveId(this: unknown, source: unknown) {
                    return `${(this as { root: string }).root}\\${String(source)}`;
                },
            },
        ]);
        const hook = plugin.resolveId as unknown as (this: { root: string }, source: string) => Promise<unknown>;
        expect(await hook.call({ root: 'C:\\repo' }, 'a.js')).toBe('C:/repo/a.js');
    });
});
