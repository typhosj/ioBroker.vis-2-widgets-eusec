import { type Capabilities, type DeviceRef, type PageLocation, detectCapabilities, record } from './device';

/** The part of the vis-2 socket the widgets use; `LegacyConnection` satisfies it. */
export interface LinkSocket {
    /** Reads one object. */
    getObject(id: string): Promise<unknown>;
    /** Reads the objects of one type in an ID range. */
    getObjectView(start: string, end: string, type: 'state'): Promise<Record<string, unknown>>;
    /** Reads one state. */
    getState(id: string): Promise<unknown>;
    /** Subscribes; calls the handler once with the current value, after another round trip. */
    subscribeState(id: string, cb: ioBroker.StateChangeHandler): Promise<void>;
    /** Drops one subscription. */
    unsubscribeState(id: string, cb?: ioBroker.StateChangeHandler): void;
    /** Writes one state. */
    setState(id: string, val: ioBroker.StateValue, ack?: boolean): Promise<void>;
}

/** Receives the state changes of a DeviceLink. */
export interface DeviceListener {
    /** `livestream` is non-empty (true), or empty or deleted (false). */
    onLivestream(active: boolean): void;
    /** `system.adapter.eusec.N.alive` changed. */
    onAlive(alive: boolean): void;
    /**
     * Sanitized `picture_url` and its `ts`. Not `lc`: eusec writes the same file name for every
     * event, so the value - and with it `lc` - stays the same while the picture changes.
     */
    onPicture(url: string, changedAt: number): void;
}

/**
 * Keeps a picture path of the web server or an http(s) URL, drops everything else and the
 * `.unknown` file eusec stores for an undecodable cloud picture. eusec writes the admin path
 * `/files/eusec.N/...`; the web adapter, which serves vis-2, answers it with 404 and serves the
 * file under `/eusec.N/...`.
 *
 * @param value Value of `picture_url`
 * @returns The URL for an img, or ''
 */
export function pictureUrl(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    const url = value.trim().replace(/^\/files(?=\/[^/])/, '');
    if (url.endsWith('.unknown') || url.endsWith('/')) {
        return '';
    }
    return /^\/[^/]/.test(url) || /^https?:\/\//i.test(url) ? url : '';
}

/**
 * Adds the picture's write time to its URL. eusec overwrites the same file for every event; the
 * version makes the browser load the new one.
 *
 * @param url Result of pictureUrl()
 * @param changedAt `ts` of `picture_url`
 * @returns The URL for an img
 */
export function withVersion(url: string, changedAt: number): string {
    return `${url}${url.includes('?') ? '&' : '?'}t=${changedAt}`;
}

/** Objects, subscriptions and writes of one camera. */
export class DeviceLink {
    private closed = false;
    private readonly subscribed: string[] = [];

    /**
     * @param socket vis-2 socket
     * @param device The camera
     * @param page Location of the vis page
     * @param listener Receives the state changes
     */
    constructor(
        private readonly socket: LinkSocket,
        private readonly device: DeviceRef,
        private readonly page: PageLocation,
        private readonly listener: DeviceListener,
    ) {}

    /**
     * Reads the objects and the instance config, then subscribes.
     *
     * @returns The capabilities, or null when the channel is no eusec camera or the link was closed meanwhile
     */
    async open(): Promise<Capabilities | null> {
        const { channelId, instance } = this.device;
        const aliveId = `system.adapter.${instance}.alive`;
        const [objects, instanceObject, livestream, alive] = await Promise.all([
            this.socket.getObjectView(`${channelId}.`, `${channelId}.香`, 'state'),
            // A vis user without read access to system.adapter.* gets an error here; the camera
            // still plays, with the defaults of an unknown eusec version.
            this.socket.getObject(`system.adapter.${instance}`).catch((error: unknown) => {
                console.warn(
                    `vis-2-widgets-eusec: cannot read system.adapter.${instance}, using defaults: ${String(error)}`,
                );
                return null;
            }),
            this.socket.getState(`${channelId}.livestream`),
            // Unreadable like the instance object: the widget then assumes eusec runs until the
            // subscription says otherwise.
            this.socket.getState(aliveId).catch(() => undefined),
        ]);
        const states = record(objects);
        const stateIds = Object.keys(states);
        // start_stream exists for every camera in every supported version; livestream does not,
        // eusec 3.0.x deletes it when a stream ends.
        if (this.closed || !stateIds.includes(`${channelId}.start_stream`)) {
            return null;
        }
        const caps = detectCapabilities({
            device: this.device,
            stateIds,
            presetStates: record(record(states[`${channelId}.preset_position`]).common).states,
            native: record(instanceObject).native,
            livestreamUrl: record(livestream).val,
            page: this.page,
        });
        // The subscriptions report the current values only after another round trip, and a widget
        // that starts its stream before it knows one already runs would later stop it for everyone.
        this.onState(`${channelId}.livestream`, livestream);
        if (alive !== undefined) {
            this.onState(aliveId, alive);
        }
        for (const id of [`${channelId}.livestream`, `${channelId}.picture_url`, aliveId]) {
            this.subscribed.push(id);
            this.socket
                .subscribeState(id, this.onState)
                .catch((error: unknown) =>
                    console.warn(`vis-2-widgets-eusec: cannot subscribe ${id}: ${String(error)}`),
                );
        }
        return caps;
    }

    /**
     * Writes a command state of the camera. Works after close() too, so an unmounting widget can
     * still stop its stream.
     *
     * @param name State name below the channel, e.g. `start_stream`
     * @param val Value to write
     */
    write(name: string, val: ioBroker.StateValue): void {
        this.socket
            .setState(`${this.device.channelId}.${name}`, val, false)
            .catch((error: unknown) => console.warn(`vis-2-widgets-eusec: cannot write ${name}: ${String(error)}`));
    }

    /** Drops the subscriptions; later changes are ignored. */
    close(): void {
        this.closed = true;
        // One call per ID: given an array, socket-client tells the server to drop the whole array,
        // also for other widgets that still need some of these IDs.
        for (const id of this.subscribed.splice(0)) {
            this.socket.unsubscribeState(id, this.onState);
        }
    }

    private readonly onState = (id: string, state: unknown): void => {
        if (this.closed) {
            return;
        }
        const { channelId, instance } = this.device;
        const { val, ts } = record(state);
        if (id === `${channelId}.livestream`) {
            this.listener.onLivestream(typeof val === 'string' && val !== '');
        } else if (id === `system.adapter.${instance}.alive`) {
            this.listener.onAlive(val === true);
        } else if (id === `${channelId}.picture_url`) {
            this.listener.onPicture(pictureUrl(val), typeof ts === 'number' ? ts : 0);
        }
    };
}
