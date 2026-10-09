const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

const adapterName = require('./package.json').name.replace('iobroker.', '');
const srcTs = `${__dirname}/src-widgets-ts/`;
const widgetTarget = `${__dirname}/widgets/${adapterName}`;

// npm is npm.cmd on Windows, which only runs through a shell. Every argument below is a fixed
// literal, never user input.
const npm = (args, cwd) => execFileSync('npm', args, { cwd, shell: true, stdio: 'inherit' });

rmSync(`${srcTs}build`, { recursive: true, force: true });
rmSync(widgetTarget, { recursive: true, force: true });

if (!existsSync(`${srcTs}node_modules`)) {
    // `ci`, not `install`: the bundle is committed, and `install` may resolve newer patch versions
    // than the lockfile pins, so a cold machine would build different bytes from the same commit.
    npm([existsSync(`${srcTs}package-lock.json`) ? 'ci' : 'install'], srcTs);
}
npm(['run', 'build'], srcTs);

mkdirSync(widgetTarget, { recursive: true });
for (const file of ['customWidgets.js', 'customWidgets.ssr.js', 'mf-stats.json']) {
    if (existsSync(`${srcTs}build/${file}`)) {
        cpSync(`${srcTs}build/${file}`, `${widgetTarget}/${file}`);
    }
}
if (existsSync(`${srcTs}build/assets`)) {
    cpSync(`${srcTs}build/assets`, `${widgetTarget}/assets`, { recursive: true });
}
