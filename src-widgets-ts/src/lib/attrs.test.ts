import { describe, expect, it } from 'vitest';

import { LIMITS, clampNumber } from './attrs';

describe('clampNumber', () => {
    it('passes a value inside the range through', () => {
        expect(clampNumber(60, 5, 600, 30)).toBe(60);
        expect(clampNumber('45', 5, 600, 30)).toBe(45);
    });

    it('clamps to the bounds', () => {
        expect(clampNumber(3, 5, 600, 30)).toBe(5);
        expect(clampNumber(5000, 5, 600, 30)).toBe(600);
    });

    it('falls back to the default for empty, non-numeric, infinite and negative values', () => {
        for (const value of [
            undefined,
            null,
            '',
            '  ',
            'abc',
            Number.NaN,
            Number.POSITIVE_INFINITY,
            -1,
            '-5',
            {},
            true,
        ]) {
            expect(clampNumber(value, 5, 600, 30)).toBe(30);
        }
    });

    it('keeps 0 as a value and clamps it, it is not negative', () => {
        expect(clampNumber(0, 5, 600, 30)).toBe(5);
    });

    it('defines the limits of the spec', () => {
        expect(LIMITS).toEqual({
            closeAfterS: { min: 5, max: 600, def: 60 },
            startTimeoutS: { min: 5, max: 120, def: 30 },
            ptzRepeatMs: { min: 300, max: 5000, def: 500 },
            sizePercent: { min: 30, max: 100, def: 100 },
        });
    });
});
