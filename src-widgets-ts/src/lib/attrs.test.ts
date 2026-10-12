import { afterEach, describe, expect, it, vi } from 'vitest';

import { LIMITS, MAX_CSS_LENGTH, clampNumber, cssValue } from './attrs';

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
            titleSizePx: { min: 10, max: 48, def: 16 },
        });
    });
});

describe('cssValue', () => {
    afterEach(() => vi.unstubAllGlobals());

    /** A browser that knows hex colours and font names without quotes or semicolons. */
    function stubBrowser(): void {
        vi.stubGlobal('CSS', {
            supports: (property: string, value: string) =>
                property === 'color' ? /^#[0-9a-f]{3,8}$/i.test(value) : /^[\w ,-]+$/.test(value),
        });
    }

    it('passes a value the browser accepts through, trimmed', () => {
        stubBrowser();
        expect(cssValue(' #243949 ', 'color', '#000')).toBe('#243949');
        expect(cssValue('RobotoCondensed-Regular', 'font-family', 'sans-serif')).toBe('RobotoCondensed-Regular');
    });

    it('falls back for a value the browser rejects', () => {
        stubBrowser();
        expect(cssValue('blau', 'color', '#000')).toBe('#000');
        expect(cssValue('Roboto; color: red', 'font-family', 'sans-serif')).toBe('sans-serif');
    });

    it('falls back for empty, non-string and overlong values', () => {
        stubBrowser();
        for (const value of [undefined, null, '', '   ', 42, {}, true]) {
            expect(cssValue(value, 'color', '#000')).toBe('#000');
        }
        expect(cssValue(`#${'a'.repeat(MAX_CSS_LENGTH)}`, 'color', '#000')).toBe('#000');
        expect(cssValue('a'.repeat(MAX_CSS_LENGTH), 'font-family', 'x')).toBe('a'.repeat(MAX_CSS_LENGTH));
    });

    it('takes any short string without CSS.supports', () => {
        vi.stubGlobal('CSS', undefined);
        expect(cssValue(' blau ', 'color', '#000')).toBe('blau');
    });
});
