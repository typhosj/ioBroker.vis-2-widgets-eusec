import React, { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
const dialogOf = (index: number): HTMLElement => document.querySelector(`[aria-label="dialog${index}"]`)!;
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
    it('focuses the dialog itself on open, not the close button', async () => {
        // A popup opened by a trigger has no pointer input before it, so the browser drew its focus
        // ring around a focused close button.
        await mount([true]);
        expect(document.activeElement).toBe(dialogOf(0));
        expect(dialogOf(0).tabIndex).toBe(-1);
        expect(dialogOf(0).style.outline).toBe('none');
    });

    it('lets Tab leave the dialog element for the close button and wraps Shift+Tab to the last', async () => {
        await mount([true]);
        // The browser moves forward to the first element by itself.
        expect(tab().defaultPrevented).toBe(false);
        const backward = tab(true);
        expect(backward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(byId('inner0'));
    });

    it('wraps Shift+Tab from the dialog element to the close button when it is the only element', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await settle(() =>
            root!.render(
                <LiveDialog
                    open
                    title="dialog0"
                    sizePercent={100}
                    onClose={() => undefined}
                >
                    {null}
                </LiveDialog>,
            ),
        );
        expect(document.activeElement).toBe(dialogOf(0));
        expect(tab(true).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(closeOf(0));
    });

    it('wraps Tab from the last element to the first and Shift+Tab back', async () => {
        await mount([true]);
        await settle(() => closeOf(0).focus());
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

describe('LiveDialog closing', () => {
    async function mountTwo(): Promise<Array<ReturnType<typeof vi.fn>>> {
        const closes = [vi.fn(), vi.fn()];
        const container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await settle(() =>
            root!.render(
                <>
                    {closes.map((onClose, index) => (
                        <LiveDialog
                            key={index}
                            open
                            title={`dialog${index}`}
                            sizePercent={50}
                            onClose={onClose}
                        >
                            <button
                                type="button"
                                id={`inner${index}`}
                            >
                                inner
                            </button>
                        </LiveDialog>
                    ))}
                </>,
            ),
        );
        return closes;
    }

    function escape(): void {
        act(() => {
            (document.activeElement ?? document.body).dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            );
        });
    }

    it('closes only the dialog with the focus on Escape, not every open one', async () => {
        const [first, second] = await mountTwo();
        expect(document.activeElement).toBe(dialogOf(1));
        escape();
        expect(second).toHaveBeenCalledOnce();
        expect(first).not.toHaveBeenCalled();
        await settle(() => byId('inner0').focus());
        escape();
        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
    });

    it('closes the newest dialog on Escape when the focus is in none of them', async () => {
        const [first, second] = await mountTwo();
        act(() => (document.activeElement as HTMLElement).blur());
        expect(document.activeElement).toBe(document.body);
        escape();
        expect(second).toHaveBeenCalledOnce();
        expect(first).not.toHaveBeenCalled();
    });

    function press(down: Element, up: Element): void {
        act(() => {
            down.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            up.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
    }

    it('closes on a click on the backdrop, not on one inside the panel', async () => {
        const [first] = await mountTwo();
        press(byId('inner0'), byId('inner0'));
        press(byId('inner0').parentElement!, byId('inner0').parentElement!);
        expect(first).not.toHaveBeenCalled();
        press(dialogOf(0), dialogOf(0));
        expect(first).toHaveBeenCalledOnce();
    });

    it('stays open when a press inside the panel is released over the backdrop', async () => {
        // The browser sends the click to the common ancestor of press and release: the backdrop.
        const [first] = await mountTwo();
        press(byId('inner0'), dialogOf(0));
        expect(first).not.toHaveBeenCalled();
    });

    it('stays open when the pressed control stops the pointerdown, as the pan and tilt buttons do', async () => {
        const [first] = await mountTwo();
        press(dialogOf(0), byId('inner0'));
        byId('inner0').addEventListener('pointerdown', event => event.stopPropagation());
        press(byId('inner0'), dialogOf(0));
        expect(first).not.toHaveBeenCalled();
    });
});
