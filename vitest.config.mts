import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['src-widgets-ts/src/**/*.test.{ts,tsx}', 'src-widgets-ts/*.test.ts'],
        setupFiles: ['test/widgets.setup.ts'],
    },
});
