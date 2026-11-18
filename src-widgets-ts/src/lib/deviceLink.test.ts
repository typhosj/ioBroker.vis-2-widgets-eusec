import { describe, expect, it, vi } from 'vitest';

import { CHANNEL, cameraObjects, fakeSocket, stateOf } from '../test/fakeSocket';
import { parseDeviceChannel } from './device';
import { DeviceLink, type DeviceListener, pictureUrl, subscribeStates, withVersion } from './deviceLink';

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
            expect.arrayContaining(['live:false', 'alive:true', 'picture:/eusec.0/T8010P00/last_event/T8410P00.jpg@7']),
        );
    });

    it('reports livestream and alive before open() resolves, not only when the subscriptions answer', async () => {
        const socket = fakeSocket({
            objects: cameraObjects(['start_stream', 'livestream']),
            states: { [ALIVE]: stateOf(false), [`${CHANNEL}.livestream`]: stateOf('http://h:1984/stream.html') },
            slowSubscribe: true,
        });
        const events = listener();
        await new DeviceLink(socket, device, page, events).open();
        expect(events.calls).toEqual(['live:true', 'alive:false']);
    });

    it('reports a missing livestream as ended and leaves alive open when it cannot be read', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['start_stream']), slowSubscribe: true });
        const getState = socket.getState;
        socket.getState = id => (id === ALIVE ? Promise.reject(new Error('permissionError')) : getState(id));
        const events = listener();
        expect(await new DeviceLink(socket, device, page, events).open()).not.toBeNull();
        expect(events.calls).toEqual(['live:false']);
    });

    it('reports nothing when closed before the values arrived', async () => {
        const socket = fakeSocket({
            objects: cameraObjects(['start_stream']),
            states: { [`${CHANNEL}.livestream`]: stateOf('http://h:1984/stream.html') },
            slowSubscribe: true,
        });
        const events = listener();
        const link = new DeviceLink(socket, device, page, events);
        const opening = link.open();
        link.close();
        expect(await opening).toBeNull();
        expect(events.calls).toEqual([]);
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

    it('reports every new picture by its write time, also when eusec writes the same file name again', async () => {
        const url = '/files/eusec.0/T8010P00/last_event/T8410P00.jpg';
        const socket = fakeSocket({
            objects: cameraObjects(['start_stream', 'picture_url']),
            states: { [`${CHANNEL}.picture_url`]: stateOf(url, true, 7) },
        });
        const events = listener();
        await new DeviceLink(socket, device, page, events).open();
        events.calls.length = 0;
        socket.emit(`${CHANNEL}.picture_url`, url, true, 9);
        socket.emit(`${CHANNEL}.picture_url`, null);
        expect(events.calls).toEqual(['picture:/eusec.0/T8010P00/last_event/T8410P00.jpg@9', 'picture:@0']);
    });

    it('returns null for a channel without start_stream', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['picture_url']) });
        expect(await new DeviceLink(socket, device, page, listener()).open()).toBeNull();
        expect(socket.handlers.size).toBe(0);
    });

    it('falls back to the defaults when the instance object cannot be read', async () => {
        // socket-client rejects getObject() with the server's error, e.g. for a vis user without
        // read access to system.adapter.*. The camera is still there.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const socket = fakeSocket({ objects: cameraObjects(['start_stream', 'pan_left']) });
        socket.getObject = () => Promise.reject(new Error('permissionError'));
        const caps = await new DeviceLink(socket, device, page, listener()).open();
        expect(caps).toMatchObject({
            onDemand: false,
            playerEvents: false,
            ptz: true,
            streamName: 'T8410P00',
            playerBaseUrl: 'http://192.168.178.106:1984',
        });
        expect(socket.handlers.size).toBe(3);
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it('still reports a camera that does not exist when the instance object cannot be read', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const socket = fakeSocket({ objects: cameraObjects(['picture_url']) });
        socket.getObject = () => Promise.reject(new Error('permissionError'));
        expect(await new DeviceLink(socket, device, page, listener()).open()).toBeNull();
        warn.mockRestore();
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

    it('reports what changed while the page was offline once it is back', async () => {
        const url = '/files/eusec.0/T8010P00/last_event/T8410P00.jpg';
        const socket = fakeSocket({
            objects: cameraObjects(['start_stream', 'livestream']),
            states: {
                [ALIVE]: stateOf(true),
                [`${CHANNEL}.livestream`]: stateOf('http://h:1984/stream.html'),
                [`${CHANNEL}.picture_url`]: stateOf(url, true, 7),
            },
        });
        const events = listener();
        await new DeviceLink(socket, device, page, events).open();
        await Promise.resolve();
        socket.disconnect();
        // eusec 3.0.x deletes livestream when the stream ends.
        socket.emit(`${CHANNEL}.livestream`, null);
        socket.emit(`${CHANNEL}.picture_url`, url, true, 9);
        socket.emit(ALIVE, false);
        events.calls.length = 0;
        socket.reconnect();
        await Promise.resolve();
        expect(events.calls.sort()).toEqual(
            ['live:false', 'alive:false', 'picture:/eusec.0/T8010P00/last_event/T8410P00.jpg@9'].sort(),
        );
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

describe('withVersion', () => {
    it('appends the write time as a new or an additional query parameter', () => {
        expect(withVersion('/eusec.0/a.jpg', 7)).toBe('/eusec.0/a.jpg?t=7');
        expect(withVersion('https://cam.example/a.jpg?size=1', 0)).toBe('https://cam.example/a.jpg?size=1&t=0');
    });
});

describe('pictureUrl', () => {
    it('turns the admin path eusec writes into the path the web adapter serves', () => {
        // eusec writes /files/eusec.0/...; web, which serves vis-2, answers that with 404 and
        // serves the file under /eusec.0/...
        expect(pictureUrl('/files/eusec.0/T8010P00/last_event/T8410P00.jpg')).toBe(
            '/eusec.0/T8010P00/last_event/T8410P00.jpg',
        );
        expect(pictureUrl(' /files/eusec.1/a.jpg ')).toBe('/eusec.1/a.jpg');
    });

    it('keeps other paths of the web server and http URLs', () => {
        expect(pictureUrl('/eusec.0/T8010P00/last_event/T8410P00.jpg')).toBe(
            '/eusec.0/T8010P00/last_event/T8410P00.jpg',
        );
        expect(pictureUrl('/filesystem/x.jpg')).toBe('/filesystem/x.jpg');
        expect(pictureUrl('https://cam.example/files/x.jpg')).toBe('https://cam.example/files/x.jpg');
    });

    it('drops undecodable pictures, protocol-relative and script URLs', () => {
        for (const value of [
            '/files/eusec.0/T8010P00/last_event/T8410P00.unknown',
            '//evil.example/x.jpg',
            '/files/',
            '/',
            'javascript:alert(1)',
            '',
            42,
            null,
        ]) {
            expect(pictureUrl(value)).toBe('');
        }
    });

    it('never turns /files//host into a protocol-relative URL', () => {
        expect(pictureUrl('/files//evil.example/x.jpg')).toBe('/files//evil.example/x.jpg');
    });
});

describe('subscribeStates', () => {
    const A = 'test.0.a';
    const B = 'test.0.b';

    it('reads every state again after a reconnect, after onReconnect, and not on a disconnect', async () => {
        const socket = fakeSocket({ states: { [A]: stateOf(1), [B]: stateOf(2) } });
        const seen: string[] = [];
        subscribeStates(
            socket,
            [A, B],
            (id, state) => void seen.push(`${id}=${String(state?.val)}`),
            () => seen.push('reconnect'),
        );
        await Promise.resolve();
        expect(seen.sort()).toEqual([`${A}=1`, `${B}=2`]);
        seen.length = 0;
        socket.disconnect();
        socket.emit(A, 3);
        await Promise.resolve();
        expect(seen).toEqual([]);
        socket.reconnect();
        await Promise.resolve();
        expect(seen[0]).toBe('reconnect');
        expect(seen.slice(1).sort()).toEqual([`${A}=3`, `${B}=2`]);
    });

    it('still delivers the other states when one cannot be read', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const socket = fakeSocket({ states: { [B]: stateOf(2) } });
        const getState = socket.getState;
        socket.getState = id => (id === A ? Promise.reject(new Error('permissionError')) : getState(id));
        const seen: string[] = [];
        subscribeStates(socket, [A, B], id => void seen.push(id));
        await Promise.resolve();
        seen.length = 0;
        socket.reconnect();
        await Promise.resolve();
        await Promise.resolve();
        expect(seen).toEqual([B]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(`cannot read ${A}`));
        warn.mockRestore();
    });

    it('delivers nothing after unsubscribe, also no answer that was on its way', async () => {
        const socket = fakeSocket({ states: { [A]: stateOf(1) } });
        let answer: (state: ioBroker.State) => void = () => undefined;
        socket.getState = () => new Promise(resolve => (answer = resolve));
        const seen: string[] = [];
        const unsubscribe = subscribeStates(socket, [A], id => void seen.push(id));
        await Promise.resolve();
        seen.length = 0;
        socket.reconnect();
        unsubscribe();
        answer(stateOf(5));
        await Promise.resolve();
        expect(seen).toEqual([]);
        expect(socket.connectionHandlers.size).toBe(0);
        expect(socket.unsubscribed).toEqual([A]);
    });

    it('subscribes with a socket that reports no connection changes', async () => {
        const socket = fakeSocket({ states: { [A]: stateOf(1) } });
        delete socket.registerConnectionHandler;
        delete socket.unregisterConnectionHandler;
        const seen: string[] = [];
        const unsubscribe = subscribeStates(socket, [A], id => void seen.push(id));
        await Promise.resolve();
        expect(seen).toEqual([A]);
        unsubscribe();
        expect(socket.unsubscribed).toEqual([A]);
    });
});
