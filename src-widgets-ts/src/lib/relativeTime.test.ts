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
