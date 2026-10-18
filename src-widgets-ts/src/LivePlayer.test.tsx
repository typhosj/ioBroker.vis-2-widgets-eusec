import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import EusecLive from './EusecLive';
import { LivePlayer, type LivePlayerProps } from './LivePlayer';
import { CHANNEL, type FakeSocket, cameraObjects, fakeSocket, stateOf } from './test/fakeSocket';
import { settle } from './test/settle';

const ALIVE = 'system.adapter.eusec.0.alive';
const mounted: Array<() => void> = [];

async function mount(element: React.ReactElement): Promise<HTMLElement> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await settle(() => root.render(element));
    mounted.push(() => act(() => root.unmount()));
    return container;
}

afterEach(() => {
    mounted.splice(0).forEach(unmount => unmount());
    document.body.innerHTML = '';
});

function player(socket: FakeSocket, overrides: Partial<LivePlayerProps> = {}): React.ReactElement {
    return (
        <LivePlayer
            socket={socket}
            channelId={CHANNEL}
            active
            audio={false}
            mode="mse"
            startTimeoutS={30}
            ptz="hover"
            ptzRepeatMs={500}
            {...overrides}
        />
    );
}

function camera302(): FakeSocket {
    return fakeSocket({
        objects: cameraObjects(['start_stream', 'stop_stream', 'picture_url']),
        states: { [ALIVE]: stateOf(true) },
        native: { hostname: '', go2rtc_api_port: 1984 },
    });
}

describe('LivePlayer', () => {
    it('asks for a camera when none is selected', async () => {
        const container = await mount(player(fakeSocket(), { channelId: '' }));
        expect(container.textContent).toContain('vis_2_widgets_eusec_noDevice');
    });

    it('says so when the channel is no eusec camera', async () => {
        const container = await mount(player(fakeSocket({ objects: cameraObjects(['picture_url']) })));
        expect(container.textContent).toContain('vis_2_widgets_eusec_notFound');
    });

    it('eusec 3.0.2: writes start_stream and sets the iframe once the livestream runs', async () => {
        const socket = camera302();
        const container = await mount(player(socket));
        expect(socket.writes).toEqual([{ id: `${CHANNEL}.start_stream`, val: true, ack: false }]);
        expect(container.querySelector('iframe')).toBeNull();
        await settle(() =>
            socket.emit(`${CHANNEL}.livestream`, 'http://192.168.178.106:1984/stream.html?src=T8410P00'),
        );
        expect(container.querySelector('iframe')?.getAttribute('src')).toContain('stream.html?src=T8410P00&mode=mse');
        // go2rtc's page may run scripts in its own origin, but neither navigate the vis page nor open popups.
        expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
        // Nothing in the player takes keys (controls=false); a Tab inside the cross-origin frame would
        // leave the page or the dialog.
        expect(container.querySelector('iframe')?.getAttribute('tabindex')).toBe('-1');
    });

    it('never starts a stream in the editor', async () => {
        const socket = camera302();
        await mount(player(socket, { active: false }));
        expect(socket.writes).toEqual([]);
    });

    it('stops its own stream on unmount', async () => {
        const socket = camera302();
        await mount(player(socket));
        mounted.splice(0).forEach(unmount => unmount());
        expect(socket.writes.map(write => write.id)).toEqual([`${CHANNEL}.start_stream`, `${CHANNEL}.stop_stream`]);
    });

    it('does not start while eusec is not running', async () => {
        const socket = fakeSocket({ objects: cameraObjects(['start_stream']), states: { [ALIVE]: stateOf(false) } });
        const container = await mount(player(socket));
        expect(socket.writes).toEqual([]);
        expect(container.textContent).toContain('vis_2_widgets_eusec_notRunning');
    });

    it('shows the pan and tilt controls only for a camera that has them', async () => {
        const plain = await mount(player(camera302(), { ptz: 'always' }));
        expect(plain.querySelector('[aria-label="vis_2_widgets_eusec_panLeft"]')).toBeNull();
        const ptz = fakeSocket({
            objects: cameraObjects(['start_stream', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down']),
            states: { [ALIVE]: stateOf(true) },
        });
        const withPtz = await mount(player(ptz, { ptz: 'always' }));
        expect(withPtz.querySelector('[aria-label="vis_2_widgets_eusec_panLeft"]')).not.toBeNull();
    });
});

describe('EusecLive', () => {
    it('declares its template ID and the device attribute', () => {
        const info = EusecLive.getWidgetInfo();
        expect(info.id).toBe('tplVis2EusecLive');
        expect(info.visSet).toBe('vis-2-widgets-eusec');
        expect(info.visAttrs[0].fields.map(field => field.name)).toEqual([
            'device',
            'audio',
            'startTimeout',
            'ptz',
            'ptzRepeat',
            'mode',
        ]);
    });

    it('renders the player with the selected camera', () => {
        const widget = new EusecLive({
            context: { socket: fakeSocket() },
            editMode: true,
        } as unknown as ConstructorParameters<typeof EusecLive>[0]);
        widget.state = { ...widget.state, rxData: { device: '' } } as unknown as typeof widget.state;
        const html = renderToStaticMarkup(widget.renderWidgetBody({} as Parameters<EusecLive['renderWidgetBody']>[0]));
        expect(html).toContain('vis_2_widgets_eusec_noDevice');
    });
});
