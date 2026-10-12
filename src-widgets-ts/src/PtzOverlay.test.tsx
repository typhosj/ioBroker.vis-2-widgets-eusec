import React, { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PtzOverlay, type PtzOverlayProps } from './PtzOverlay';

type Write = { name: string; val: ioBroker.StateValue };

const REPEAT_MS = 500;
let root: Root | null = null;

function mount(overrides: Partial<PtzOverlayProps> = {}): { container: HTMLElement; writes: Write[] } {
    const writes: Write[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
        root!.render(
            <PtzOverlay
                mode="always"
                presets={[]}
                repeatMs={REPEAT_MS}
                write={(name, val) => writes.push({ name, val })}
                {...overrides}
            />,
        ),
    );
    return { container, writes };
}

function button(container: HTMLElement, label: string): HTMLElement {
    const found = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    if (!found) {
        throw new Error(`no button ${label}`);
    }
    return found;
}

function pointer(target: Element, type: string, init: PointerEventInit = {}): void {
    act(() => {
        target.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
    });
}

function advance(ms: number): void {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

function names(writes: Write[]): string[] {
    return writes.map(write => write.name);
}

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    vi.useRealTimers();
});

describe('PtzOverlay', () => {
    it('moves once on press and repeats at the interval while held', () => {
        const { container, writes } = mount();
        pointer(button(container, 'vis2_eusec_panLeft'), 'pointerdown');
        expect(writes).toEqual([{ name: 'pan_left', val: true }]);
        advance(REPEAT_MS * 3);
        expect(names(writes)).toEqual(['pan_left', 'pan_left', 'pan_left', 'pan_left']);
    });

    it.each([
        ['releasing', 'pointerup'],
        ['cancelling', 'pointercancel'],
    ])('stops repeating on %s the button', (_label, type) => {
        const { container, writes } = mount();
        const tiltUp = button(container, 'vis2_eusec_tiltUp');
        pointer(tiltUp, 'pointerdown');
        pointer(tiltUp, type);
        advance(REPEAT_MS * 4);
        expect(names(writes)).toEqual(['tilt_up']);
    });

    it('stops repeating when the pointer leaves the button', () => {
        const { container, writes } = mount();
        const tiltDown = button(container, 'vis2_eusec_tiltDown');
        pointer(tiltDown, 'pointerdown');
        // React derives onPointerLeave from pointerout with the element the pointer went to.
        pointer(tiltDown, 'pointerout', { relatedTarget: document.body });
        advance(REPEAT_MS * 4);
        expect(names(writes)).toEqual(['tilt_down']);
    });

    it('runs one repeat at a time when pressed twice without a release', () => {
        const { container, writes } = mount();
        const panRight = button(container, 'vis2_eusec_panRight');
        pointer(panRight, 'pointerdown');
        pointer(panRight, 'pointerdown');
        advance(REPEAT_MS);
        expect(names(writes)).toEqual(['pan_right', 'pan_right', 'pan_right']);
    });

    it('writes nothing after it unmounts while a button is held', () => {
        const { container, writes } = mount();
        pointer(button(container, 'vis2_eusec_panLeft'), 'pointerdown');
        act(() => root?.unmount());
        root = null;
        advance(REPEAT_MS * 4);
        expect(names(writes)).toEqual(['pan_left']);
    });

    it('moves once for a keyboard click and not again for the click after a press', () => {
        const { container, writes } = mount();
        const panLeft = button(container, 'vis2_eusec_panLeft');
        act(() => {
            panLeft.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
        });
        pointer(panLeft, 'pointerdown');
        pointer(panLeft, 'pointerup');
        act(() => {
            panLeft.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        });
        expect(names(writes)).toEqual(['pan_left', 'pan_left']);
    });

    it('writes rotate_360 and the preset number once per click', () => {
        const { container, writes } = mount({
            presets: [
                { value: 0, label: 'Door' },
                { value: 3, label: 'Garden' },
            ],
        });
        act(() => button(container, 'vis2_eusec_rotate').click());
        act(() => button(container, 'Garden').click());
        advance(REPEAT_MS * 4);
        expect(writes).toEqual([
            { name: 'rotate_360', val: true },
            { name: 'preset_position', val: 3 },
        ]);
    });

    it('shows no preset row without presets', () => {
        const { container } = mount();
        expect(container.querySelectorAll('button')).toHaveLength(5);
    });

    it('on tap: hidden until tapped, hidden again five seconds after the last touch', () => {
        const { container, writes } = mount({ mode: 'hover' });
        expect(container.querySelector('button')).toBeNull();
        pointer(container.firstElementChild!, 'pointerdown');
        expect(container.querySelector('button')).not.toBeNull();
        expect(writes).toEqual([]);
        advance(4_999);
        expect(container.querySelector('button')).not.toBeNull();
        advance(1);
        expect(container.querySelector('button')).toBeNull();
    });

    it('on tap: stays visible while a button is held', () => {
        const { container } = mount({ mode: 'hover' });
        pointer(container.firstElementChild!, 'pointerdown');
        pointer(button(container, 'vis2_eusec_panLeft'), 'pointerdown');
        advance(20_000);
        expect(container.querySelector('[aria-label="vis2_eusec_panLeft"]')).not.toBeNull();
    });
});
