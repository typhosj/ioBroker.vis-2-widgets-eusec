import type { LinkSocket } from '../lib/deviceLink';

/** Camera channel used by all component tests. */
export const CHANNEL = 'eusec.0.T8010P00.cameras.T8410P00';

/** A LinkSocket that records what the widget does. */
export interface FakeSocket extends LinkSocket {
    /** Current subscriptions by state ID. */
    handlers: Map<string, ioBroker.StateChangeHandler>;
    /** Every setState call. */
    writes: Array<{ id: string; val: ioBroker.StateValue; ack: boolean | undefined }>;
    /** Every first argument of unsubscribeState. */
    unsubscribed: unknown[];
    /** Sends a state change to the subscriber; null means the state was deleted. */
    emit(id: string, val: ioBroker.StateValue | null, ack?: boolean, lc?: number): void;
}

/**
 * A state as the socket delivers it.
 *
 * @param val Value
 * @param ack Confirmed by the adapter
 * @param lc Last change (ms)
 * @returns The state
 */
export function stateOf(val: ioBroker.StateValue, ack = true, lc = 1): ioBroker.State {
    return { val, ack, ts: lc, lc, from: 'system.adapter.test.0', q: 0 };
}

/**
 * State objects below CHANNEL, by name.
 *
 * @param names State names below the channel
 * @param presetStates `common.states` of `preset_position`
 * @returns The objects by ID
 */
export function cameraObjects(
    names: readonly string[],
    presetStates?: Record<string, string>,
): Record<string, unknown> {
    return Object.fromEntries(
        names.map(name => [
            `${CHANNEL}.${name}`,
            {
                _id: `${CHANNEL}.${name}`,
                type: 'state',
                common: name === 'preset_position' ? { states: presetStates } : {},
                native: {},
            },
        ]),
    );
}

/**
 * A socket like socket-client's: subscribeState() calls the handler once with the current value.
 *
 * @param options Objects, states and instance config the socket answers with
 * @param options.objects State objects by ID
 * @param options.states States by ID
 * @param options.native `native` of every instance object
 * @returns The socket
 */
export function fakeSocket(
    options: { objects?: Record<string, unknown>; states?: Record<string, ioBroker.State>; native?: unknown } = {},
): FakeSocket {
    const objects = options.objects ?? {};
    const states = options.states ?? {};
    const handlers = new Map<string, ioBroker.StateChangeHandler>();
    const writes: FakeSocket['writes'] = [];
    const unsubscribed: unknown[] = [];
    return {
        handlers,
        writes,
        unsubscribed,
        getObjectView: (start, end) =>
            Promise.resolve(Object.fromEntries(Object.entries(objects).filter(([id]) => id >= start && id <= end))),
        getObject: id =>
            Promise.resolve(
                id.startsWith('system.adapter.')
                    ? { _id: id, type: 'instance', common: {}, native: options.native ?? {} }
                    : (objects[id] ?? null),
            ),
        getState: id => Promise.resolve(states[id] ?? null),
        subscribeState: (id, cb) => {
            handlers.set(id, cb);
            void cb(id, states[id] ?? null);
            return Promise.resolve();
        },
        unsubscribeState: id => {
            unsubscribed.push(id);
            handlers.delete(id);
        },
        setState: (id, val, ack) => {
            writes.push({ id, val, ack });
            return Promise.resolve();
        },
        emit(id, val, ack = true, lc = 2) {
            void handlers.get(id)?.(id, val === null ? null : stateOf(val, ack, lc));
        },
    };
}
