/** API port of go2rtc when the instance config has none (eusec default). */
export const DEFAULT_API_PORT = 1984;
/** Suffix of the transcoded stream of a device listed for the compatibility stream (go2rtcStreamName() in eusec). */
export const COMPAT_STREAM_SUFFIX = '_compat';
/** eusec defines four presets; more than this is a broken object. */
const MAX_PRESETS = 8;

const CHANNEL = /^(eusec\.\d+)\.[A-Za-z0-9_-]+\.cameras\.([A-Za-z0-9_-]+)$/;
// Known limit: IPv6 literals are not accepted as host name, neither in the config nor as page host.
const HOSTNAME = /^[A-Za-z0-9.-]+$/;
const MODE = /^(mse|webrtc|hls|mjpeg)(,(mse|webrtc|hls|mjpeg))*$/;

/** One eusec camera, from its channel ID. */
export interface DeviceRef {
    /** Adapter instance, e.g. `eusec.0`. */
    instance: string;
    /** Camera channel, e.g. `eusec.0.T8010P00.cameras.T8410P00`. */
    channelId: string;
    /** Serial of the camera, the last part of the channel ID. */
    serial: string;
}

/** One preset button. */
export interface PresetOption {
    /** Value written to `preset_position`. */
    value: number;
    /** Button text, from `common.states`. */
    label: string;
}

/** What the installed eusec offers for one camera. */
export interface Capabilities {
    /** Opening the player starts the stream (eusec 3.4.0). */
    onDemand: boolean;
    /** stream.html posts `eusec-stream` events (eusec 3.4.0). */
    playerEvents: boolean;
    /** Pan and tilt states exist. */
    ptz: boolean;
    /** Preset buttons, empty before eusec 3.2.0 or for devices without presets. */
    presets: PresetOption[];
    /** go2rtc stream the player plays. */
    streamName: string;
    /** Origin of go2rtc, e.g. `http://192.168.178.106:1984`. */
    playerBaseUrl: string;
    /** The vis page is https, the player http: the browser blocks the iframe. */
    mixedContent: boolean;
}

/** The parts of location the detection needs. */
export interface PageLocation {
    /** `location.protocol` of the vis page, e.g. `http:`. */
    protocol: string;
    /** `location.hostname` of the vis page. */
    hostname: string;
}

/** Everything detectCapabilities() reads. */
export interface CapabilityInput {
    /** The selected camera. */
    device: DeviceRef;
    /** IDs of all state objects below the channel. */
    stateIds: readonly string[];
    /** `common.states` of the `preset_position` object. */
    presetStates: unknown;
    /** `native` of `system.adapter.eusec.N`. */
    native: unknown;
    /** Current value of the `livestream` state. */
    livestreamUrl: unknown;
    /** Location of the vis page. */
    page: PageLocation;
}

/**
 * Treats anything that is not a plain object as an empty one.
 *
 * @param value Untrusted value
 * @returns The value as record, or an empty record
 */
export function record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Splits the ID the user picked in the editor into instance, channel and serial.
 *
 * @param id Value of the device attribute
 * @returns The camera, or null for anything that is not a camera channel of eusec
 */
export function parseDeviceChannel(id: unknown): DeviceRef | null {
    if (typeof id !== 'string') {
        return null;
    }
    const match = CHANNEL.exec(id.trim());
    return match ? { instance: match[1], channelId: match[0], serial: match[2] } : null;
}

function httpOrigin(url: unknown): string | null {
    if (typeof url !== 'string' || url === '') {
        return null;
    }
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
    } catch {
        return null;
    }
}

function validPort(value: unknown): number {
    const port = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535 ? port : DEFAULT_API_PORT;
}

function presetOptions(states: unknown): PresetOption[] {
    return Object.entries(record(states))
        .filter(([key]) => /^\d+$/.test(key))
        .map(([key, label]) => ({ value: Number(key), label: typeof label === 'string' ? label : `Preset ${key}` }))
        .sort((a, b) => a.value - b.value)
        .slice(0, MAX_PRESETS);
}

/**
 * Works out what the installed eusec offers, from its objects and instance config.
 *
 * @param input Objects, config and page of the widget
 * @returns The capabilities
 */
export function detectCapabilities(input: CapabilityInput): Capabilities {
    const native = record(input.native);
    const { channelId, serial } = input.device;
    const has = (name: string): boolean => input.stateIds.includes(`${channelId}.${name}`);
    const configured = typeof native.hostname === 'string' ? native.hostname.trim() : '';
    const host = HOSTNAME.test(configured)
        ? configured
        : HOSTNAME.test(input.page.hostname)
          ? input.page.hostname
          : 'localhost';
    const compat = Array.isArray(native.compatStreamDevices) && native.compatStreamDevices.includes(serial);
    const playerBaseUrl =
        httpOrigin(input.livestreamUrl) ??
        httpOrigin(`http://${host}:${validPort(native.go2rtc_api_port)}`) ??
        `http://localhost:${DEFAULT_API_PORT}`;
    return {
        onDemand: native.livestreamOnDemand === true,
        playerEvents: 'livestreamOnDemand' in native,
        ptz: has('pan_left') || has('tilt_up'),
        presets: has('preset_position') ? presetOptions(input.presetStates) : [],
        streamName: compat ? `${serial}${COMPAT_STREAM_SUFFIX}` : serial,
        playerBaseUrl,
        mixedContent: input.page.protocol === 'https:' && playerBaseUrl.startsWith('http:'),
    };
}

/**
 * Builds the URL of the player page for the iframe.
 *
 * @param caps Base URL and stream
 * @param options Audio on or off, and the player mode attribute
 * @param options.audio Play the sound of the camera
 * @param options.mode Value of the mode attribute, `mse` when invalid
 * @returns The iframe URL
 */
export function playerSrc(
    caps: Pick<Capabilities, 'playerBaseUrl' | 'streamName'>,
    options: { audio: boolean; mode: unknown },
): string {
    const mode = typeof options.mode === 'string' && MODE.test(options.mode) ? options.mode : 'mse';
    const query = new URLSearchParams({
        src: caps.streamName,
        mode,
        background: 'false',
        controls: 'false',
        audio: options.audio ? 'true' : 'false',
    });
    return `${caps.playerBaseUrl}/stream.html?${query.toString()}`;
}
