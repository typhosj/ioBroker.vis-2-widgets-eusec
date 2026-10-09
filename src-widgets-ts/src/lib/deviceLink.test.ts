import { describe, expect, it, vi } from 'vitest';

import { CHANNEL, cameraObjects, fakeSocket, stateOf } from '../testing/fakeSocket';
import { parseDeviceChannel } from './device';
import { DeviceLink, type DeviceListener, pictureUrl } from './deviceLink';

const device = parseDeviceChannel(CHANNEL)!;
const page = { protocol: 'http:', hostname: '192.168.178.106' };
const ALIVE = 'system.adapter.eusec.0.alive';

function listener(): DeviceListener & { calls: string[] } {
    const calls: string[] = [];
    return {
        calls,
        onLivestream: active => calls.push(`live:${active}`),
        onAlive: alive => calls.push(`alive:${alive}`),
        onPicture: (url, changedAt) => calls.push(`picture:${url}@${changedAt}`),
    };
}

describe('DeviceLink', () => {
    it('reads the capabilities and subscribes to livestream, picture and alive', async () => {
        const socket = fakeSocket({
            objects: cameraObjects(['start_stream', 'livestream', 'picture_url', 'pan_left']),
            states: {
                [ALIVE]: stateOf(true),
                [`${CHANNEL}.picture_url`]: stateOf('/files/eusec.0/T8010P00/last_event/T8410P00.jpg', true, 7),
            },
            native: { go2rtc_api_port: 1984, livestreamOnDemand: true },
        });
        const events = listener();
        const caps = await new DeviceLink(socket, device, page, events).open();
        expect(caps).toMatchObject({ onDemand: true, ptz: true, streamName: 'T8410P00' });
        expect([...socket.handlers.keys()].sort()).toEqual(
            [`${CHANNEL}.livestream`, `${CHANNEL}.picture_url`, ALIVE].sort(),
        );
        expect(events.calls).toEqual(
            expect.arrayContaining([
                'live:false',
                'alive:true',
                'picture:/files/eusec.0/T8010P00/last_event/T8410P00.jpg@7',
            ]),
        );
    });

    it('reports a livestream URL as active and an emptied or deleted state as ended', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['start_stream']) });
        const events = listener();
        await new DeviceLink(socket, device, page, events).open();
        events.calls.length = 0;
        socket.emit(`${CHANNEL}.livestream`, 'http://h:1984/stream.html?src=T8410P00');
        socket.emit(`${CHANNEL}.livestream`, '');
        socket.emit(`${CHANNEL}.livestream`, null);
        expect(events.calls).toEqual(['live:true', 'live:false', 'live:false']);
    });

    it('returns null for a channel without start_stream', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['picture_url']) });
        expect(await new DeviceLink(socket, device, page, listener()).open()).toBeNull();
        expect(socket.handlers.size).toBe(0);
    });

    it('does not subscribe when closed before the objects arrived', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['start_stream']) });
        let release: () => void = () => undefined;
        const gate = new Promise<void>(resolve => (release = resolve));
        const view = socket.getObjectView;
        socket.getObjectView = async (start, end, type) => {
            await gate;
            return view(start, end, type);
        };
        const link = new DeviceLink(socket, device, page, listener());
        const opening = link.open();
        link.close();
        release();
        expect(await opening).toBeNull();
        expect(socket.handlers.size).toBe(0);
    });

    it('unsubscribes every ID on its own, never as an array', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['start_stream']) });
        const link = new DeviceLink(socket, device, page, listener());
        await link.open();
        link.close();
        expect(socket.unsubscribed).toHaveLength(3);
        expect(socket.unsubscribed.every(id => typeof id === 'string')).toBe(true);
    });

    it('ignores changes after close', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['start_stream']) });
        const events = listener();
        const link = new DeviceLink(socket, device, page, events);
        await link.open();
        const handler = socket.handlers.get(`${CHANNEL}.livestream`)!;
        link.close();
        events.calls.length = 0;
        void handler(`${CHANNEL}.livestream`, stateOf('http://h:1984/x'));
        expect(events.calls).toEqual([]);
    });

    it('writes a command below the channel, unacknowledged, also after close', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['start_stream']) });
        const link = new DeviceLink(socket, device, page, listener());
        await link.open();
        link.close();
        link.write('stop_stream', true);
        expect(socket.writes).toEqual([{ id: `${CHANNEL}.stop_stream`, val: true, ack: false }]);
    });

    it('logs a failed write instead of throwing', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['start_stream']) });
        socket.setState = () => Promise.reject(new Error('permission'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        new DeviceLink(socket, device, page, listener()).write('start_stream', true);
        await Promise.resolve();
        await Promise.resolve();
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });
});

describe('pictureUrl', () => {
    it('keeps paths of the web server and http URLs', () => {
        expect(pictureUrl('/files/eusec.0/T8010P00/last_event/T8410P00.jpg')).toBe(
            '/files/eusec.0/T8010P00/last_event/T8410P00.jpg',
        );
        expect(pictureUrl('https://cam.example/x.jpg')).toBe('https://cam.example/x.jpg');
    });

    it('drops undecodable pictures, protocol-relative and script URLs', () => {
        for (const value of [
            '/files/eusec.0/T8010P00/last_event/T8410P00.unknown',
            '//evil.example/x.jpg',
            'javascript:alert(1)',
            '',
            42,
            null,
        ]) {
            expect(pictureUrl(value)).toBe('');
        }
    });
});
