import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EusecEventPopup, {
    EventPopup,
    type EventPopupProps,
    emptyOrPrefilled,
    prefillTriggers,
} from './EusecEventPopup';
import { CHANNEL, type FakeSocket, cameraObjects, fakeSocket, stateOf } from './test/fakeSocket';
import { settle } from './test/settle';
import type { DialogLook } from './widgetInfo';

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

function camera(personNow = false, personSince = 1): FakeSocket {
    return fakeSocket({
        objects: cameraObjects(['start_stream', 'stop_stream', 'person_detected']),
        states: {
            [PERSON]: stateOf(personNow, true, personSince),
            'system.adapter.eusec.0.alive': stateOf(true),
        },
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

    it('does not open for a trigger that has been true for longer than the close time', async () => {
        await mount(popup(camera(true, Date.now() - 60_001)));
        expect(dialog()).toBeNull();
    });

    it('opens for a trigger that turned true shortly before the view was shown', async () => {
        await mount(popup(camera(true, Date.now() - 5_000)));
        expect(dialog()).not.toBeNull();
        await settle(() => vi.advanceTimersByTime(60_000));
        expect(dialog()).toBeNull();
    });

    it('styles the dialog with the look attributes', async () => {
        const socket = camera();
        const look: DialogLook = {
            overlayColor: 'rgb(1, 2, 3)',
            background: 'rgb(36, 57, 73)',
            headerBackground: 'rgb(4, 5, 6)',
            titleColor: 'rgb(238, 246, 251)',
            font: 'RobotoCondensed-Regular',
            titleSizePx: 22,
            closeColor: 'rgb(155, 220, 243)',
        };
        await mount(popup(socket, { look }));
        await settle(() => socket.emit(PERSON, true));
        const backdrop = dialog() as HTMLElement;
        const panel = backdrop.firstElementChild as HTMLElement;
        const header = panel.firstElementChild as HTMLElement;
        const title = header.firstElementChild as HTMLElement;
        const close = document.body.querySelector('[aria-label="vis_2_widgets_eusec_close"]') as HTMLElement;
        expect(backdrop.style.background).toBe('rgb(1, 2, 3)');
        expect(panel.style.background).toBe('rgb(36, 57, 73)');
        expect(panel.style.fontFamily).toBe('RobotoCondensed-Regular');
        expect(header.style.background).toBe('rgb(4, 5, 6)');
        expect(title.style.color).toBe('rgb(238, 246, 251)');
        expect(header.style.fontSize).toBe('22px');
        expect(close.style.color).toBe('rgb(155, 220, 243)');
    });

    it('closes by the close button', async () => {
        const socket = camera();
        await mount(popup(socket));
        await settle(() => socket.emit(PERSON, true));
        await settle(() =>
            (document.body.querySelector('[aria-label="vis_2_widgets_eusec_close"]') as HTMLButtonElement).click(),
        );
        expect(dialog()).toBeNull();
    });

    it('shows a marker in the editor and never subscribes there', async () => {
        const socket = camera();
        await mount(popup(socket, { editMode: true }));
        expect(document.body.textContent).toContain('vis_2_widgets_eusec_popupPlaceholder');
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

    it('asks for all default triggers at once and keeps their order', async () => {
        const asked: string[] = [];
        const answers: Array<() => void> = [];
        const found = prefillTriggers(CHANNEL, id => {
            asked.push(id);
            return new Promise(resolve => answers.push(() => resolve(true)));
        });
        await Promise.resolve();
        expect(asked).toEqual([`${CHANNEL}.ringing`, PERSON]);
        answers.reverse().forEach(answer => answer());
        expect(await found).toEqual([`${CHANNEL}.ringing`, PERSON]);
    });
});

describe('emptyOrPrefilled', () => {
    const OTHER = CHANNEL.replace(/T8410P00$/, 'T8410P01');

    it('takes empty triggers and what the editor filled in for any camera', () => {
        expect(emptyOrPrefilled([])).toBe(true);
        expect(emptyOrPrefilled(['', ' ', 'nothing_selected', undefined, 42])).toBe(true);
        expect(emptyOrPrefilled([`${OTHER}.ringing`, `${OTHER}.person_detected`, ''])).toBe(true);
        expect(emptyOrPrefilled([` ${OTHER}.person_detected `, undefined, undefined])).toBe(true);
    });

    it('keeps triggers the user picked', () => {
        expect(emptyOrPrefilled(['javascript.0.doorbell', '', ''])).toBe(false);
        expect(emptyOrPrefilled([`${OTHER}.ringing`, `${OTHER}.person_detected`, 'javascript.0.doorbell'])).toBe(false);
        // Order, gaps and a mix of cameras are no prefill.
        expect(emptyOrPrefilled([`${OTHER}.person_detected`, `${OTHER}.ringing`, ''])).toBe(false);
        expect(emptyOrPrefilled(['', `${OTHER}.ringing`, ''])).toBe(false);
        expect(emptyOrPrefilled([`${OTHER}.ringing`, PERSON, ''])).toBe(false);
        expect(emptyOrPrefilled([`${OTHER}.motion_detected`, '', ''])).toBe(false);
        expect(emptyOrPrefilled(['eusec.0.station.ringing', '', ''])).toBe(false);
    });

    it('gives a newly chosen camera its own defaults in the editor', async () => {
        const field = EusecEventPopup.getWidgetInfo()
            .visAttrs.flatMap(group => group.fields)
            .find(candidate => candidate.name === 'device')!;
        const socket = fakeSocket({ objects: cameraObjects(['ringing', 'person_detected']) });
        const changeData = vi.fn();
        const onChange = 'onChange' in field ? (field.onChange as (...args: unknown[]) => Promise<void>) : undefined;
        const change = (data: Record<string, unknown>): Promise<void> => onChange!(field, data, changeData, socket);
        await change({ device: CHANNEL, trigger1: `${OTHER}.ringing`, trigger2: `${OTHER}.person_detected` });
        expect(changeData).toHaveBeenCalledWith(
            expect.objectContaining({ device: CHANNEL, trigger1: `${CHANNEL}.ringing`, trigger2: PERSON }),
        );
        changeData.mockClear();
        await change({ device: CHANNEL, trigger1: 'javascript.0.doorbell' });
        expect(changeData).not.toHaveBeenCalled();
    });
});
