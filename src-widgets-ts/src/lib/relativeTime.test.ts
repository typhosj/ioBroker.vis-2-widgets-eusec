import { describe, expect, it } from 'vitest';

import { relativeTime } from './relativeTime';

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0);

describe('relativeTime', () => {
    it('picks the unit by age', () => {
        expect(relativeTime(NOW - 30_000, NOW, 'en')).toBe('30 seconds ago');
        expect(relativeTime(NOW - 3 * 60_000, NOW, 'en')).toBe('3 minutes ago');
        expect(relativeTime(NOW - 2 * 3_600_000, NOW, 'en')).toBe('2 hours ago');
        expect(relativeTime(NOW - 24 * 3_600_000, NOW, 'en')).toBe('yesterday');
    });

    it('moves to the next unit where the count would round up to it', () => {
        expect(relativeTime(NOW - 59_499, NOW, 'en')).toBe('59 seconds ago');
        expect(relativeTime(NOW - 59_500, NOW, 'en')).toBe('1 minute ago');
        expect(relativeTime(NOW - 59 * 60_000 - 29_999, NOW, 'en')).toBe('59 minutes ago');
        expect(relativeTime(NOW - 59 * 60_000 - 30_000, NOW, 'en')).toBe('1 hour ago');
        expect(relativeTime(NOW - 23 * 3_600_000 - 1_799_999, NOW, 'en')).toBe('23 hours ago');
        expect(relativeTime(NOW - 23 * 3_600_000 - 1_800_000, NOW, 'en')).toBe('yesterday');
        expect(relativeTime(NOW - 499, NOW, 'en')).toBe('now');
        expect(relativeTime(NOW - 500, NOW, 'en')).toBe('1 second ago');
    });

    it('speaks German', () => {
        expect(relativeTime(NOW - 3 * 60_000, NOW, 'de')).toBe('vor 3 Minuten');
    });

    it('returns nothing for a missing time and treats a future time as now', () => {
        expect(relativeTime(0, NOW, 'en')).toBe('');
        expect(relativeTime(NOW + 5_000, NOW, 'en')).toBe('now');
    });

    it('falls back to English for an unknown language', () => {
        expect(relativeTime(NOW - 3 * 60_000, NOW, 'xx-invalid-')).toBe('3 minutes ago');
    });
});
