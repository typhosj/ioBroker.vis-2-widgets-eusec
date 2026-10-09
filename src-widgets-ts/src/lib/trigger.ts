/** States of a camera channel that open the popup by default, where they exist. */
export const DEFAULT_TRIGGERS: readonly string[] = ['ringing', 'person_detected'];

/**
 * Fires when a trigger state changes to true and the adapter confirmed it. The first value per
 * state is the baseline: a true that is already there when the page loads opens nothing.
 */
export class TriggerWatcher {
    private readonly last = new Map<string, boolean>();

    /** @param onFire Called with the ID of the trigger that fired */
    constructor(private readonly onFire: (id: string) => void) {}

    /**
     * Feeds a value of a trigger state.
     *
     * @param id State ID
     * @param state New state, null or undefined when it does not exist
     */
    update(id: string, state: { val: unknown; ack: boolean } | null | undefined): void {
        const active = state?.val === true;
        if (active && state?.ack !== true) {
            // A command, not yet confirmed by the adapter.
            return;
        }
        const previous = this.last.get(id);
        this.last.set(id, active);
        if (previous === false && active) {
            this.onFire(id);
        }
    }
}

/** Keeps the popup open for a while after the last trigger. */
export class AutoClose {
    private timer: ReturnType<typeof setTimeout> | undefined;
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
        this.timer = setTimeout(() => this.close(), this.closeAfterMs);
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
