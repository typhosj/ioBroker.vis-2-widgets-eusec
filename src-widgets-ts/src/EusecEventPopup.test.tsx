import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventPopup, type EventPopupProps, prefillTriggers } from './EusecEventPopup';
import { CHANNEL, type FakeSocket, cameraObjects, fakeSocket, stateOf } from './test/fakeSocket';
import { settle } from './test/settle';

const PERSON = `${CHANNEL}.person_detected`;
const mounted: Array<() => void> = [];

async function mount(element: React.ReactElement): Promise<void> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await settle(() => root.render(element));
    mounted.push(() => act(() => root.unmount()));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    mounted.splice(0).forEach(unmount => unmount());
    document.body.innerHTML = '';
    vi.useRealTimers();
});

function popup(socket: FakeSocket, overrides: Partial<EventPopupProps> = {}): React.ReactElement {
    return (
        <EventPopup
            socket={socket}
            channelId={CHANNEL}
            triggers={[PERSON]}
            closeAfterS={60}
            sizePercent={100}
            title="Haustür"
            editMode={false}
            player={{ audio: false, mode: 'mse', startTimeoutS: 30, ptz: 'never', ptzRepeatMs: 500 }}
            {...overrides}
        />
    );
}

function camera(personNow = false): FakeSocket {
    return fakeSocket({
        objects: cameraObjects(['start_stream', 'stop_stream', 'person_detected']),
        states: { [PERSON]: stateOf(personNow), 'system.adapter.eusec.0.alive': stateOf(true) },
        native: { livestreamOnDemand: true },
    });
}

const dialog = (): Element | null => document.body.querySelector('[role="dialog"]');

describe('EventPopup', () => {
    it('opens on a confirmed trigger and closes after the time', async () => {
        const socket = camera();
        await mount(popup(socket));
        expect(dialog()).toBeNull();
        await settle(() => socket.emit(PERSON, true));
        expect(dialog()?.getAttribute('aria-label')).toBe('Haustür');
        await settle(() => vi.advanceTimersByTime(60_000));
        expect(dialog()).toBeNull();
    });

    it('does not open for a trigger that is already true on page load', async () => {
        await mount(popup(camera(true)));
        expect(dialog()).toBeNull();
    });

    it('closes by the close button', async () => {
        const socket = camera();
        await mount(popup(socket));
        await settle(() => socket.emit(PERSON, true));
        await settle(() =>
            (document.body.querySelector('[aria-label="vis2_eusec_close"]') as HTMLButtonElement).click(),
        );
        expect(dialog()).toBeNull();
    });

    it('shows a marker in the editor and never subscribes there', async () => {
        const socket = camera();
        await mount(popup(socket, { editMode: true }));
        expect(document.body.textContent).toContain('vis2_eusec_popupPlaceholder');
        expect(socket.handlers.size).toBe(0);
    });

    it('unsubscribes the triggers on unmount', async () => {
        const socket = camera();
        await mount(popup(socket));
        mounted.splice(0).forEach(unmount => unmount());
        expect(socket.unsubscribed).toContain(PERSON);
    });
});

describe('prefillTriggers', () => {
    it('takes ringing and person detection where they exist', async () => {
        const existing = new Set([`${CHANNEL}.person_detected`]);
        expect(await prefillTriggers(CHANNEL, id => Promise.resolve(existing.has(id)))).toEqual([
            `${CHANNEL}.person_detected`,
        ]);
    });

    it('ignores an unusable channel', async () => {
        expect(await prefillTriggers('nothing_selected', () => Promise.resolve(true))).toBeNull();
    });
});
