import { describe, expect, it } from 'vitest';

import { readPlayerEvent } from './playerMessage';

const frame = { name: 'iframe window' };
const expected = { origin: 'http://192.168.178.106:1984', window: frame, src: 'T8410P00' };

function message(
    data: unknown,
    overrides: Partial<{ origin: string; source: unknown }> = {},
): { origin: string; source: unknown; data: unknown } {
    return { origin: expected.origin, source: frame, data, ...overrides };
}

describe('readPlayerEvent', () => {
    it('reads an event of the own player', () => {
        expect(readPlayerEvent(message({ type: 'eusec-stream', src: 'T8410P00', state: 'playing' }), expected)).toEqual(
            { state: 'playing' },
        );
        expect(
            readPlayerEvent(
                message({ type: 'eusec-stream', src: 'T8410P00', state: 'waiting', detail: 'Garage' }),
                expected,
            ),
        ).toEqual({
            state: 'waiting',
            detail: 'Garage',
        });
    });

    it('accepts the explicit undefined detail that stream.html sends', () => {
        expect(
            readPlayerEvent(
                message({ type: 'eusec-stream', src: 'T8410P00', state: 'playing', detail: undefined }),
                expected,
            ),
        ).toEqual({ state: 'playing' });
    });

    it('rejects a foreign origin, a foreign window and a missing iframe', () => {
        const data = { type: 'eusec-stream', src: 'T8410P00', state: 'playing' };
        expect(readPlayerEvent(message(data, { origin: 'http://evil.example' }), expected)).toBeNull();
        expect(readPlayerEvent(message(data, { source: {} }), expected)).toBeNull();
        expect(readPlayerEvent(message(data, { source: null }), { ...expected, window: null })).toBeNull();
    });

    it('rejects events of another camera on the same page', () => {
        expect(
            readPlayerEvent(message({ type: 'eusec-stream', src: 'T8410P01', state: 'playing' }), expected),
        ).toBeNull();
    });

    it('rejects malformed payloads', () => {
        for (const data of [
            null,
            'playing',
            42,
            [],
            { type: 'other', src: 'T8410P00', state: 'playing' },
            { type: 'eusec-stream', src: 'T8410P00', state: 'exploded' },
            { type: 'eusec-stream', src: 'T8410P00', state: 'error', detail: 42 },
        ]) {
            expect(readPlayerEvent(message(data), expected)).toBeNull();
        }
    });

    it('cuts an overlong detail', () => {
        const event = readPlayerEvent(
            message({ type: 'eusec-stream', src: 'T8410P00', state: 'error', detail: 'x'.repeat(1000) }),
            expected,
        );
        expect(event?.detail).toHaveLength(200);
    });
});
