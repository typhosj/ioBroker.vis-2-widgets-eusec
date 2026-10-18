'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const pkg = readJson('package.json');
const io = readJson('io-package.json');

assert.strictEqual(pkg.name, `iobroker.${io.common.name}`);
assert.strictEqual(pkg.version, io.common.version);
assert.strictEqual(pkg.license, io.common.licenseInformation.license);
assert.ok(fs.existsSync(path.join(root, pkg.main)), 'package.json main must exist - run npm run build');
assert.ok(Object.keys(io.common.news).length <= 7, 'common.news must contain at most 7 entries');
assert.strictEqual(io.common.onlyWWW, true);

const vite = fs.readFileSync(path.join(root, 'src-widgets-ts/vite.config.ts'), 'utf8');
for (const component of io.common.visWidgets.vis2WidgetsEusec.components) {
    assert.ok(vite.includes(`'./${component}'`), `${component} must be exposed in vite.config.ts`);
}

// The React 18 copies of react/jsx-runtime and react-dom that the widget bundle carries as share
// fallbacks read React's internals the moment they are evaluated. Under vis-2 with React 19 those
// internals are gone, so a fallback that is evaluated before the share scope is asked crashes the
// whole widget set (ioBroker.vis-2#689). A fallback may therefore never be in the static import
// closure of the remote entry or of an exposed widget; a loader chunk that is itself only reached
// through import() may import it statically.
function eagerFallbacks(chunks, entries) {
    const isFallback = code =>
        code.includes('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner') ||
        (code.includes('createPortal=') && code.includes('.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED='));
    const offenders = [];
    for (const entry of entries) {
        const seen = new Set();
        const stack = [entry];
        while (stack.length) {
            const name = stack.pop();
            if (seen.has(name) || chunks[name] === undefined) {
                continue;
            }
            seen.add(name);
            if (isFallback(chunks[name])) {
                offenders.push(`${entry} -> ${name}`);
            }
            for (const match of chunks[name].matchAll(/(?:from|import)\s*"\.\/(?:assets\/)?([^"]+)"/g)) {
                stack.push(match[1]);
            }
        }
    }
    return offenders;
}
const jsxFallback = 'var o=t.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner;export{o as jsx};';
const domFallback = 'var c=1;exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=x;exports.createPortal=c;';
assert.deepStrictEqual(
    eagerFallbacks({ 'widget.js': 'import{n as e}from"./jsx.js";', 'jsx.js': jsxFallback }, ['widget.js']),
    ['widget.js -> jsx.js'],
);
// Through a chain of static imports, and from the remote entry, which names its chunks below assets/.
assert.deepStrictEqual(
    eagerFallbacks({ 'entry.js': 'import"./assets/a.js";', 'a.js': 'import"./dom.js";', 'dom.js': domFallback }, [
        'entry.js',
    ]),
    ['entry.js -> dom.js'],
);
// A loader reached through import() may import the fallback statically.
assert.deepStrictEqual(
    eagerFallbacks(
        { 'map.js': 'e(()=>import(`./loader.js`));', 'loader.js': 'import"./dom.js";', 'dom.js': domFallback },
        ['map.js'],
    ),
    [],
);
// Import cycles end, missing chunks and an empty bundle pass.
assert.deepStrictEqual(eagerFallbacks({ 'a.js': 'import"./b.js";', 'b.js': 'import"./a.js";' }, ['a.js']), []);
assert.deepStrictEqual(eagerFallbacks({ 'widget.js': 'import"./gone.js";' }, ['widget.js']), []);
assert.deepStrictEqual(eagerFallbacks({}, []), []);
const widgetDir = path.join(root, 'widgets', io.common.name);
const builtChunks = Object.fromEntries(
    fs
        .readdirSync(path.join(widgetDir, 'assets'))
        .filter(name => name.endsWith('.js'))
        .map(name => [name, fs.readFileSync(path.join(widgetDir, 'assets', name), 'utf8')]),
);
builtChunks['customWidgets.js'] = fs.readFileSync(path.join(widgetDir, 'customWidgets.js'), 'utf8');
const components = io.common.visWidgets.vis2WidgetsEusec.components;
const entries = Object.keys(builtChunks).filter(
    name => name === 'customWidgets.js' || components.some(component => name.startsWith(`${component}-`)),
);
assert.strictEqual(
    entries.length,
    components.length + 1,
    'a chunk of every exposed widget must exist - run npm run build',
);
assert.deepStrictEqual(
    eagerFallbacks(builtChunks, entries),
    [],
    'React 18 share fallbacks must only be loaded through import(), or the widget set crashes on vis-2 with React 19',
);
console.log('package-custom: ok');
