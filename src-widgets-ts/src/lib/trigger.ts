/** States of a camera channel that open the popup by default, where they exist. */
export const DEFAULT_TRIGGERS: readonly string[] = ['ringing', 'person_detected'];

/**
 * Fires when a trigger state changes to true and the adapter confirmed it. The first value per
 * state is the baseline: a true that is already there when the page loads or the view opens
 * fires only if it turned true at most `recentMs` ago. A script that switches the view right
 * after the event still gets its popup; a true that hangs from long ago opens nothing on reload.
 */
export class TriggerWatcher {
    private readonly last = new Map<string, boolean>();

    /**
     * @param onFire Called with the ID of the trigger that fired
     * @param recentMs How old a true found at the start may be and still fire; 0 never fires
     * @param now Clock of the page
     */
    constructor(
        private readonly onFire: (id: string) => void,
        private readonly recentMs: number,
        private readonly now: () => number = Date.now,
    ) {}

    /**
     * Feeds a value of a trigger state.
     *
     * @param id State ID
     * @param state New state, null or undefined when it does not exist
     */
    update(id: string, state: { val: unknown; ack: boolean; lc?: number } | null | undefined): void {
        const active = state?.val === true;
        if (active && state?.ack !== true) {
            // A command, not yet confirmed by the adapter.
            return;
        }
        const previous = this.last.get(id);
        this.last.set(id, active);
        if (active && (previous === false || (previous === undefined && this.isRecent(state?.lc)))) {
            this.onFire(id);
        }
    }

    private isRecent(lc: unknown): boolean {
        // lc is the server's clock; the absolute age also takes a page clock running behind it.
        return (
            this.recentMs > 0 &&
            typeof lc === 'number' &&
            Number.isFinite(lc) &&
            Math.abs(this.now() - lc) <= this.recentMs
        );
    }
}

/** Keeps the popup open for a while after the last trigger. */
export class AutoClose {
    private timer: number | undefined;
    private open = false;

    /**
     * @param closeAfterMs Time after the last trigger until the popup closes
     * @param onChange Called when the popup opens (true) or closes (false)
     */
    constructor(
        private readonly closeAfterMs: number,
        private readonly onChange: (open: boolean) => void,
    ) {}

    /** A trigger fired: open, or restart the time. */
    fire(): void {
        clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.close(), this.closeAfterMs);
        if (!this.open) {
            this.open = true;
            this.onChange(true);
        }
    }

    /** Closes now. */
    close(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
        if (this.open) {
            this.open = false;
            this.onChange(false);
        }
    }

    /** Drops the timer without reporting. */
    dispose(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
    }
}

/**
 * The trigger attributes that hold an object ID.
 *
 * @param values Values of the trigger attributes
 * @returns The trimmed IDs
 */
export function validTriggers(values: readonly unknown[]): string[] {
    return values
        .filter((value): value is string => typeof value === 'string')
        .map(value => value.trim())
        .filter(value => value !== '' && value !== 'nothing_selected');
}
