/** What stream.html of eusec 3.4.0 and later reports through postMessage. */
export type PlayerState = 'waiting' | 'unreachable' | 'playing' | 'paused' | 'error';

/** One checked event of the player page. */
export interface PlayerEvent {
    /** What the player reports. */
    state: PlayerState;
    /** The camera the station is busy with, the camera that does not answer, or the error text. */
    detail?: string;
}

const STATES: readonly string[] = ['waiting', 'unreachable', 'playing', 'paused', 'error'];
const MAX_DETAIL = 200;

/**
 * Accepts a message only from the widget's own iframe, from the go2rtc origin, for the widget's
 * own stream, and only in the shape stream.html sends:
 * `{ type: 'eusec-stream', src, state, detail }`.
 *
 * @param event The MessageEvent (or its relevant fields)
 * @param event.origin Origin of the sender
 * @param event.source Window of the sender
 * @param event.data Payload
 * @param expected Origin of go2rtc, contentWindow of the iframe, stream name
 * @param expected.origin Origin of go2rtc
 * @param expected.window contentWindow of the widget's iframe
 * @param expected.src Stream name the widget plays
 * @returns The event, or null for anything else
 */
export function readPlayerEvent(
    event: { origin: string; source: unknown; data: unknown },
    expected: { origin: string; window: unknown; src: string },
): PlayerEvent | null {
    if (event.origin !== expected.origin || expected.window == null || event.source !== expected.window) {
        return null;
    }
    if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) {
        return null;
    }
    const { type, src, state, detail } = event.data as Record<string, unknown>;
    if (type !== 'eusec-stream' || src !== expected.src || typeof state !== 'string' || !STATES.includes(state)) {
        return null;
    }
    if (detail !== undefined && typeof detail !== 'string') {
        return null;
    }
    const playerState = state as PlayerState;
    return detail === undefined ? { state: playerState } : { state: playerState, detail: detail.slice(0, MAX_DETAIL) };
}
