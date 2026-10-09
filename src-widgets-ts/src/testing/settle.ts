import { act } from 'react';

/**
 * Runs fn inside an async act(), so effects and pending promises settle before the test reads the
 * DOM.
 *
 * @param fn Renders, emits or clicks
 * @returns Resolves once React is done
 */
export function settle(fn: () => void): Promise<void> {
    return act(async () => {
        fn();
        await Promise.resolve();
    });
}
