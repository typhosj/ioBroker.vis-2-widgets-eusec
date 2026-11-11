const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1000],
];

const formatters = new Map<string, Intl.RelativeTimeFormat>();

function formatter(language: string): Intl.RelativeTimeFormat {
    let format = formatters.get(language);
    if (!format) {
        try {
            format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
        } catch {
            format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        }
        formatters.set(language, format);
    }
    return format;
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
    // A unit starts where the next smaller one would round up to it: 59.5 s is "1 minute", not "60 seconds".
    const [unit, size] = UNITS.find(([, ms], index) => age >= ms - (UNITS[index + 1]?.[1] ?? ms) / 2) ?? [
        'second',
        1000,
    ];
    return formatter(language).format(-Math.round(age / size), unit);
}
