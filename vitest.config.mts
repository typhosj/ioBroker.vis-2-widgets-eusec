import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['src-widgets-ts/src/**/*.test.{ts,tsx}'],
        setupFiles: ['test/widgets.setup.ts'],
    },
});
