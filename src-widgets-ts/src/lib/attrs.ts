/** Bounds and default of a numeric widget attribute. */
export interface Limit {
    /** Smallest allowed value. */
    min: number;
    /** Largest allowed value. */
    max: number;
    /** Value for empty or unusable input. */
    def: number;
}

/** The numeric attributes of the widgets, with the bounds of the spec. */
export const LIMITS = {
    closeAfterS: { min: 5, max: 600, def: 60 },
    startTimeoutS: { min: 5, max: 120, def: 30 },
    ptzRepeatMs: { min: 300, max: 5000, def: 500 },
    sizePercent: { min: 30, max: 100, def: 100 },
} satisfies Record<string, Limit>;

/**
 * Reads a numeric attribute as the vis-2 editor stores it (number or string). Empty, non-numeric,
 * infinite and negative values give the fallback; everything else is clamped into [min, max].
 *
 * @param value Attribute value
 * @param min Lower bound
 * @param max Upper bound
 * @param fallback Value for unusable input
 * @returns The number to use
 */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    const num =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim() !== ''
              ? Number(value)
              : Number.NaN;
    if (!Number.isFinite(num) || num < 0) {
        return fallback;
    }
    return Math.min(max, Math.max(min, num));
}
