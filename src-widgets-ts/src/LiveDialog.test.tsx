import React, { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { LiveDialog } from './LiveDialog';
import { settle } from './test/settle';

let root: Root | null = null;

function Page(props: { open: boolean[] }): React.JSX.Element {
    return (
        <>
            <button
                type="button"
                id="behind"
            >
                behind
            </button>
            {props.open.map((open, index) => (
                <LiveDialog
                    key={index}
                    open={open}
                    title={`dialog${index}`}
                    sizePercent={100}
                    onClose={() => undefined}
                >
                    <button
                        type="button"
                        id={`inner${index}`}
                    >
                        inner
                    </button>
                </LiveDialog>
            ))}
        </>
    );
}

async function mount(open: boolean[]): Promise<void> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await settle(() => root!.render(<Page open={open} />));
}

const byId = (id: string): HTMLElement => document.getElementById(id)!;
const closeOf = (index: number): HTMLElement =>
    document.querySelector(`[aria-label="dialog${index}"] [aria-label="vis_2_widgets_eusec_close"]`)!;

function tab(shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event);
    return event;
}

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
});

describe('LiveDialog focus trap', () => {
    it('wraps Tab from the last element to the first and Shift+Tab back', async () => {
        await mount([true]);
        expect(document.activeElement).toBe(closeOf(0));
        // The browser moves the focus forward by itself; the trap steps in only at the ends.
        expect(tab().defaultPrevented).toBe(false);
        byId('inner0').focus();
        const forward = tab();
        expect(forward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(closeOf(0));
        const backward = tab(true);
        expect(backward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(byId('inner0'));
    });

    it('takes the focus back when it reaches the page behind the dialog', async () => {
        // The player iframe is cross-origin: a Tab inside it never reaches the keydown handler and
        // can hand the focus to the page.
        await mount([true]);
        await settle(() => byId('behind').focus());
        expect(document.activeElement).toBe(closeOf(0));
    });

    it('lets two open dialogs keep their own focus instead of pulling it back and forth', async () => {
        await mount([true, true]);
        await settle(() => closeOf(0).focus());
        expect(document.activeElement).toBe(closeOf(0));
        await settle(() => closeOf(1).focus());
        expect(document.activeElement).toBe(closeOf(1));
    });

    it('does not hold the focus while closed', async () => {
        await mount([false]);
        await settle(() => byId('behind').focus());
        expect(document.activeElement).toBe(byId('behind'));
        expect(tab().defaultPrevented).toBe(false);
    });
});
