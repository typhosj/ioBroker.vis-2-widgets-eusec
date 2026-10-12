import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SnapshotTile, type SnapshotTileProps } from './EusecSnapshot';
import { CHANNEL, cameraObjects, fakeSocket, stateOf } from './test/fakeSocket';
import { settle } from './test/settle';

const PICTURE = `${CHANNEL}.picture_url`;
const mounted: Array<() => void> = [];

async function mount(props: Partial<SnapshotTileProps>, socket = fakeSocket()): Promise<HTMLElement> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await settle(() =>
        root.render(
            <SnapshotTile
                socket={socket}
                channelId={CHANNEL}
                tapOpensLive
                title="Haustür"
                sizePercent={100}
                editMode={false}
                language="en"
                player={{ audio: false, mode: 'mse', startTimeoutS: 30, ptz: 'never', ptzRepeatMs: 500 }}
                {...props}
            />,
        ),
    );
    mounted.push(() => act(() => root.unmount()));
    return container;
}

afterEach(() => {
    mounted.splice(0).forEach(unmount => unmount());
    document.body.innerHTML = '';
});

describe('SnapshotTile', () => {
    it('shows the picture with a version, so a new event loads a new file', async () => {
        const socket = fakeSocket({
            states: { [PICTURE]: stateOf('/files/eusec.0/T8010P00/last_event/T8410P00.jpg', true, 1234) },
        });
        const container = await mount({}, socket);
        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            '/files/eusec.0/T8010P00/last_event/T8410P00.jpg?t=1234',
        );
    });

    it('loads the next event picture and its age although eusec writes the same file name', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(100_000);
        try {
            const url = '/files/eusec.0/T8010P00/last_event/T8410P00.jpg';
            const socket = fakeSocket({ states: { [PICTURE]: stateOf(url, true, 1_000) } });
            const container = await mount({}, socket);
            await settle(() => socket.emit(PICTURE, url, true, 95_000));
            expect(container.querySelector('img')?.getAttribute('src')).toBe(`${url}?t=95000`);
            expect(container.textContent).toContain('5 seconds ago');
        } finally {
            vi.useRealTimers();
        }
    });

    it('says "no picture" for an undecodable picture', async () => {
        const socket = fakeSocket({
            states: { [PICTURE]: stateOf('/files/eusec.0/T8010P00/last_event/T8410P00.unknown') },
        });
        const container = await mount({}, socket);
        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toContain('vis2_eusec_noPicture');
    });

    it('opens the livestream on tap', async () => {
        const socket = fakeSocket({
            objects: cameraObjects(['start_stream']),
            states: { 'system.adapter.eusec.0.alive': stateOf(true) },
            native: { livestreamOnDemand: true },
        });
        const container = await mount({}, socket);
        await settle(() => (container.querySelector('[role="button"]') as HTMLElement).click());
        expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('does not open when tapping is switched off or in the editor', async () => {
        const off = await mount({ tapOpensLive: false });
        expect(off.querySelector('[role="button"]')).toBeNull();
        const editor = await mount({ editMode: true });
        expect(editor.querySelector('[role="button"]')).toBeNull();
    });
});
