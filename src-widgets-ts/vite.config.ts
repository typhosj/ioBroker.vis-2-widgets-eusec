import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import vitetsConfigPaths from 'vite-tsconfig-paths';
import { federation } from '@module-federation/vite';
import { moduleFederationShared } from '@iobroker/types-vis-2/modulefederation.vis.config';
import { readFileSync } from 'node:fs';

const pack = JSON.parse(readFileSync('./package.json').toString());

export default {
    plugins: [
        federation({
            manifest: true,
            name: 'vis2EusecWidgets',
            filename: 'customWidgets.js',
            exposes: {},
            remotes: {},
            shared: moduleFederationShared(pack),
            dts: false,
        }),
        react(),
        vitetsConfigPaths(),
        commonjs(),
    ],
    base: './',
    build: {
        target: 'chrome89',
        outDir: './build',
        rollupOptions: {
            output: {
                // Module federation names its virtual chunks after the whole share path (134
                // characters since @module-federation/vite 1.16.14). The checkout path plus that name
                // passes the 260 characters of Windows' MAX_PATH and `git add` fails.
                chunkFileNames: (chunk: { name: string }): string => `assets/${chunk.name.slice(0, 60)}-[hash].js`,
            },
            onwarn(warning: { code: string }, warn: (warning: { code: string }) => void): void {
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
                    return;
                }
                warn(warning);
            },
        },
    },
};
