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
    titleSizePx: { min: 10, max: 48, def: 16 },
} satisfies Record<string, Limit>;

/** Longest colour or font value taken from an attribute. */
export const MAX_CSS_LENGTH = 100;

/**
 * Reads a colour or font attribute. A value the browser does not accept for the property gives
 * the fallback, so a typo never leaves the dialog transparent or in the browser's default font.
 *
 * @param value Attribute value
 * @param property CSS property the value is for
 * @param fallback Value for unusable input
 * @returns The value to use
 */
export function cssValue(value: unknown, property: 'color' | 'font-family', fallback: string): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed === '' || trimmed.length > MAX_CSS_LENGTH) {
        return fallback;
    }
    // Known limit: without CSS.supports (jsdom) any short string is taken; React leaves out what the browser rejects.
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
        return trimmed;
    }
    return CSS.supports(property, trimmed) ? trimmed : fallback;
}

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
