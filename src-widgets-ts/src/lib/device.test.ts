import { describe, expect, it } from 'vitest';

import { type CapabilityInput, detectCapabilities, parseDeviceChannel, playerSrc } from './device';

const CHANNEL = 'eusec.0.T8010P00.cameras.T8410P00';
const device = parseDeviceChannel(CHANNEL)!;
const page = { protocol: 'http:', hostname: '192.168.178.106' };

function input(overrides: Partial<CapabilityInput> = {}): CapabilityInput {
    return { device, stateIds: [], presetStates: undefined, native: {}, livestreamUrl: '', page, ...overrides };
}

// Instance config as each eusec version stores it. 3.0.2 has neither on-demand nor the
// compatibility stream; 3.4.2 has both.
const native302 = { hostname: '', go2rtc_api_port: 1984 };
const native342 = {
    hostname: 'iobroker.fritz.box',
    go2rtc_api_port: 1985,
    livestreamOnDemand: true,
    compatStreamDevices: ['T8410P00'],
};
const PRESETS = { 0: 'Preset 1', 1: 'Preset 2', 2: 'Preset 3', 3: 'Preset 4' };

describe('parseDeviceChannel', () => {
    it('splits a camera channel', () => {
        expect(parseDeviceChannel(CHANNEL)).toEqual({ instance: 'eusec.0', channelId: CHANNEL, serial: 'T8410P00' });
        expect(parseDeviceChannel(`  ${CHANNEL} `)?.channelId).toBe(CHANNEL);
    });

    it('rejects everything that is not a camera channel of eusec', () => {
        for (const id of [
            `${CHANNEL}.livestream`,
            'foo.0.T8010P00.cameras.T8410P00',
            'eusec.0.T8010P00.stations.T8410P00',
            'eusec.0.T8410P00',
            '',
            'nothing_selected',
            undefined,
            42,
        ]) {
            expect(parseDeviceChannel(id)).toBeNull();
        }
    });
});

describe('detectCapabilities', () => {
    it('eusec 3.0.2: no on-demand, no events, player on the host of the vis page', () => {
        expect(detectCapabilities(input({ native: native302 }))).toEqual({
            onDemand: false,
            playerEvents: false,
            ptz: false,
            presets: [],
            streamName: 'T8410P00',
            playerBaseUrl: 'http://192.168.178.106:1984',
            mixedContent: false,
        });
    });

    it('eusec 3.2.0: pan, tilt and presets from the objects', () => {
        const caps = detectCapabilities(
            input({
                native: native302,
                stateIds: [`${CHANNEL}.pan_left`, `${CHANNEL}.preset_position`],
                presetStates: PRESETS,
            }),
        );
        expect(caps.ptz).toBe(true);
        expect(caps.presets).toEqual([
            { value: 0, label: 'Preset 1' },
            { value: 1, label: 'Preset 2' },
            { value: 2, label: 'Preset 3' },
            { value: 3, label: 'Preset 4' },
        ]);
    });

    it('eusec 3.4.2: on-demand, events, compatibility stream, configured host and port', () => {
        const caps = detectCapabilities(input({ native: native342 }));
        expect(caps.onDemand).toBe(true);
        expect(caps.playerEvents).toBe(true);
        expect(caps.streamName).toBe('T8410P00_compat');
        expect(caps.playerBaseUrl).toBe('http://iobroker.fritz.box:1985');
    });

    it('marks player events by the key alone, also with on-demand switched off', () => {
        const caps = detectCapabilities(input({ native: { ...native342, livestreamOnDemand: false } }));
        expect(caps.onDemand).toBe(false);
        expect(caps.playerEvents).toBe(true);
    });

    it('takes the base URL from a running livestream first', () => {
        const caps = detectCapabilities(
            input({
                native: native342,
                livestreamUrl: 'http://10.0.0.5:1984/stream.html?src=T8410P00&background=false',
            }),
        );
        expect(caps.playerBaseUrl).toBe('http://10.0.0.5:1984');
    });

    it('ignores a livestream value that is no http URL', () => {
        for (const livestreamUrl of ['javascript:alert(1)', 'garbage', 42, null]) {
            expect(detectCapabilities(input({ native: native302, livestreamUrl })).playerBaseUrl).toBe(
                'http://192.168.178.106:1984',
            );
        }
    });

    it('survives a broken instance config', () => {
        for (const native of [
            null,
            undefined,
            'x',
            [],
            { go2rtc_api_port: 'abc' },
            { go2rtc_api_port: 70000 },
            { go2rtc_api_port: 0 },
            { hostname: 'evil.com/path' },
        ]) {
            expect(detectCapabilities(input({ native })).playerBaseUrl).toBe('http://192.168.178.106:1984');
        }
    });

    it('falls back to localhost when the page host is unusable', () => {
        expect(detectCapabilities(input({ page: { protocol: 'http:', hostname: '' } })).playerBaseUrl).toBe(
            'http://localhost:1984',
        );
    });

    it('writes the base URL as an origin, so it compares equal to MessageEvent.origin', () => {
        expect(
            detectCapabilities(input({ native: { hostname: 'cam.local', go2rtc_api_port: 80 } })).playerBaseUrl,
        ).toBe('http://cam.local');
    });

    it('offers no presets without the preset object, and drops non-numeric entries', () => {
        expect(detectCapabilities(input({ presetStates: PRESETS })).presets).toEqual([]);
        const caps = detectCapabilities(
            input({ stateIds: [`${CHANNEL}.preset_position`], presetStates: { 1: 'B', x: 'bad', 0: 'A' } }),
        );
        expect(caps.presets).toEqual([
            { value: 0, label: 'A' },
            { value: 1, label: 'B' },
        ]);
    });

    it('detects an https page with an http player', () => {
        expect(detectCapabilities(input({ page: { protocol: 'https:', hostname: 'vis.example' } })).mixedContent).toBe(
            true,
        );
    });
});

describe('playerSrc', () => {
    const caps = { playerBaseUrl: 'http://192.168.178.106:1984', streamName: 'T8410P00' };

    it('builds the player URL with the fixed parameters', () => {
        expect(playerSrc(caps, { audio: false, mode: undefined })).toBe(
            'http://192.168.178.106:1984/stream.html?src=T8410P00&mode=mse&background=false&controls=false&audio=false',
        );
    });

    it('passes audio and a valid mode list', () => {
        const src = playerSrc(caps, { audio: true, mode: 'webrtc,mse' });
        expect(src).toContain('mode=webrtc%2Cmse');
        expect(src).toContain('audio=true');
    });

    it('replaces an invalid mode with mse', () => {
        expect(playerSrc(caps, { audio: false, mode: 'mse&src=other' })).toContain('mode=mse&');
    });
});
