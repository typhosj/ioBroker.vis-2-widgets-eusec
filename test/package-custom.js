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
for (const component of io.common.visWidgets.vis2EusecWidgets.components) {
    assert.ok(vite.includes(`'./${component}'`), `${component} must be exposed in vite.config.ts`);
}
console.log('package-custom: ok');
