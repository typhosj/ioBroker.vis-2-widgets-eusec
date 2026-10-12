import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LIMITS, clampNumber } from './attrs';
import { AutoClose, DEFAULT_TRIGGERS, TriggerWatcher, validTriggers } from './trigger';

const ID = 'eusec.0.T8010P00.cameras.T8410P00.person_detected';

const NOW = 1_000_000_000;
const RECENT_MS = 60_000;

function watcher(): { watch: TriggerWatcher; fired: string[] } {
    const fired: string[] = [];
    return {
        watch: new TriggerWatcher(
            id => fired.push(id),
            RECENT_MS,
            () => NOW,
        ),
        fired,
    };
}

describe('TriggerWatcher', () => {
    it('fires on a confirmed change to true', () => {
        const { watch, fired } = watcher();
        watch.update(ID, { val: false, ack: true });
        watch.update(ID, { val: true, ack: true });
        expect(fired).toEqual([ID]);
    });

    it('does not fire for an old true that is already there when the page loads', () => {
        const { watch, fired } = watcher();
        watch.update(ID, { val: true, ack: true, lc: NOW - RECENT_MS - 1 });
        expect(fired).toEqual([]);
        watch.update(ID, { val: false, ack: true });
        watch.update(ID, { val: true, ack: true });
        expect(fired).toEqual([ID]);
    });

    it('fires for a true that turned true shortly before the page loaded', () => {
        // A view change or reload right after the event, e.g. a script that leaves the screensaver.
        const { watch, fired } = watcher();
        watch.update(ID, { val: true, ack: true, lc: NOW - 5_000 });
        expect(fired).toEqual([ID]);
        watch.update(ID, { val: true, ack: true, lc: NOW - 5_000 });
        expect(fired).toEqual([ID]);
    });

    it('takes a page-load true exactly at the end of the window, not one ms later', () => {
        const atEdge = watcher();
        atEdge.watch.update(ID, { val: true, ack: true, lc: NOW - RECENT_MS });
        expect(atEdge.fired).toEqual([ID]);
        const past = watcher();
        past.watch.update(ID, { val: true, ack: true, lc: NOW - RECENT_MS - 1 });
        expect(past.fired).toEqual([]);
    });

    it('tolerates a page clock behind the server inside the window', () => {
        const ahead = watcher();
        ahead.watch.update(ID, { val: true, ack: true, lc: NOW + 3_000 });
        expect(ahead.fired).toEqual([ID]);
        const farAhead = watcher();
        farAhead.watch.update(ID, { val: true, ack: true, lc: NOW + RECENT_MS + 1 });
        expect(farAhead.fired).toEqual([]);
    });

    it('ignores a page-load true without lc, with an unusable lc or not confirmed', () => {
        for (const state of [
            { val: true, ack: true },
            { val: true, ack: true, lc: Number.NaN },
            { val: true, ack: true, lc: '5' },
            { val: true, ack: false, lc: NOW },
        ]) {
            const { watch, fired } = watcher();
            watch.update(ID, state as { val: unknown; ack: boolean; lc?: number });
            expect(fired).toEqual([]);
        }
    });

    it('never fires for a page-load true when the window is 0', () => {
        const fired: string[] = [];
        new TriggerWatcher(
            id => fired.push(id),
            0,
            () => NOW,
        ).update(ID, { val: true, ack: true, lc: NOW });
        expect(fired).toEqual([]);
    });

    it('treats a missing state as false', () => {
        const { watch, fired } = watcher();
        watch.update(ID, null);
        watch.update(ID, { val: true, ack: true });
        expect(fired).toEqual([ID]);
    });

    it('waits for the adapter to confirm', () => {
        const { watch, fired } = watcher();
        watch.update(ID, { val: false, ack: true });
        watch.update(ID, { val: true, ack: false });
        expect(fired).toEqual([]);
        watch.update(ID, { val: true, ack: true });
        expect(fired).toEqual([ID]);
    });

    it('does not fire again for a repeated true', () => {
        const { watch, fired } = watcher();
        watch.update(ID, { val: false, ack: true });
        watch.update(ID, { val: true, ack: true });
        watch.update(ID, { val: true, ack: true });
        expect(fired).toEqual([ID]);
    });

    it('keeps the triggers apart', () => {
        const { watch, fired } = watcher();
        watch.update('a', { val: true, ack: true, lc: 1 });
        watch.update('b', { val: false, ack: true });
        watch.update('b', { val: true, ack: true });
        expect(fired).toEqual(['b']);
    });
});

describe('AutoClose', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('opens and closes after the time', () => {
        const changes: boolean[] = [];
        const auto = new AutoClose(60_000, open => changes.push(open));
        auto.fire();
        vi.advanceTimersByTime(59_999);
        expect(changes).toEqual([true]);
        vi.advanceTimersByTime(1);
        expect(changes).toEqual([true, false]);
    });

    it('restarts the time on a new trigger', () => {
        const changes: boolean[] = [];
        const auto = new AutoClose(60_000, open => changes.push(open));
        auto.fire();
        vi.advanceTimersByTime(30_000);
        auto.fire();
        vi.advanceTimersByTime(59_999);
        expect(changes).toEqual([true]);
        vi.advanceTimersByTime(1);
        expect(changes).toEqual([true, false]);
    });

    it('closes by hand', () => {
        const changes: boolean[] = [];
        const auto = new AutoClose(60_000, open => changes.push(open));
        auto.fire();
        auto.close();
        vi.advanceTimersByTime(60_000);
        expect(changes).toEqual([true, false]);
    });

    it('reports nothing after dispose', () => {
        const changes: boolean[] = [];
        const auto = new AutoClose(60_000, open => changes.push(open));
        auto.fire();
        auto.dispose();
        vi.advanceTimersByTime(60_000);
        expect(changes).toEqual([true]);
    });

    it('gets a usable time from an invalid close attribute', () => {
        const { min, max, def } = LIMITS.closeAfterS;
        expect(clampNumber('', min, max, def)).toBe(60);
        expect(clampNumber(-3, min, max, def)).toBe(60);
        expect(clampNumber(1, min, max, def)).toBe(5);
    });
});

describe('validTriggers', () => {
    it('keeps set IDs and drops empty fields', () => {
        expect(validTriggers([' a.b ', '', undefined, 'nothing_selected', 42, 'c.d'])).toEqual(['a.b', 'c.d']);
    });

    it('names the states eusec creates for doorbell and person detection', () => {
        expect(DEFAULT_TRIGGERS).toEqual(['ringing', 'person_detected']);
    });
});
