import config from '@iobroker/eslint-config';

export default [
    {
        // Build output, the build script and the CommonJS package tests are not maintained source.
        ignores: ['widgets/**', 'admin/**', 'src-widgets-ts/build/**', 'node_modules/**', 'test/**', 'tasks.js', '*.config.mjs', '*.config.mts'],
    },
    ...config,
];
