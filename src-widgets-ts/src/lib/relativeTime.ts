const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1000],
];

function formatter(language: string): Intl.RelativeTimeFormat {
    try {
        return new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    } catch {
        return new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    }
}

/**
 * "3 minutes ago", in the language of vis-2.
 *
 * @param changedAt Time of the picture (ms), 0 when unknown
 * @param now Current time (ms)
 * @param language vis-2 language
 * @returns The text, or '' when the time is unknown
 */
export function relativeTime(changedAt: number, now: number, language: string): string {
    if (!changedAt) {
        return '';
    }
    const age = Math.max(0, now - changedAt);
    const [unit, size] = UNITS.find(([, ms]) => age >= ms) ?? ['second', 1000];
    return formatter(language).format(-Math.round(age / size), unit);
}
