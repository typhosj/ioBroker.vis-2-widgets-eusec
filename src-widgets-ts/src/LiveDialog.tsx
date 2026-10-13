import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { t } from './i18n';
import { LIMITS, clampNumber } from './lib/attrs';
import { DEFAULT_DIALOG_LOOK, type DialogLook } from './widgetInfo';

/** Props of LiveDialog. */
export interface LiveDialogProps {
    /** Show the dialog. */
    open: boolean;
    /** Header text. */
    title: string;
    /** Raw size attribute (% of the screen). */
    sizePercent: unknown;
    /** Colours and fonts, the old look when left out. */
    look?: DialogLook;
    /** Close button, backdrop or Escape. */
    onClose: () => void;
    /** Dialog content. */
    children: React.ReactNode;
}

const backdrop: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
const panel: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 8,
    overflow: 'hidden',
};
const header: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px',
};
const closeButton: React.CSSProperties = {
    minWidth: 44,
    height: 44,
    border: 0,
    background: 'transparent',
    fontSize: 22,
    cursor: 'pointer',
};
const body: React.CSSProperties = { position: 'relative', flex: 1 };

const TABBABLE =
    'button:not([disabled]), [href], input:not([disabled]), select, textarea, iframe:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/**
 * A full-screen (or sized) dialog above the whole vis page, closed by button, backdrop or Escape.
 *
 * @param props Open state, title, size, close handler and content
 * @returns The dialog, or null while closed
 */
export function LiveDialog(props: LiveDialogProps): React.JSX.Element | null {
    const { open, onClose } = props;
    const closeRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    // The focus goes to the close button, so Enter and Escape act on the dialog, stays inside the
    // dialog while it is open, and goes back where it came from when the dialog closes.
    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const previous = document.activeElement;
        closeRef.current?.focus();
        // Tab wraps at both ends of the dialog.
        const onTab = (event: KeyboardEvent): void => {
            const dialog = dialogRef.current;
            if (event.key !== 'Tab' || !dialog) {
                return;
            }
            const items = [...dialog.querySelectorAll<HTMLElement>(TABBABLE)];
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
                event.preventDefault();
                (event.shiftKey ? last : first)?.focus();
            }
        };
        // A Tab inside the cross-origin player iframe never reaches onTab and can hand the focus to
        // the page. Focus in another open dialog (two popups at once) is left alone, or both would
        // pull it back and forth.
        const onFocusIn = (event: FocusEvent): void => {
            const target = event.target;
            if (target instanceof Element && !target.closest('[aria-modal="true"]')) {
                closeRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onTab);
        document.addEventListener('focusin', onFocusIn);
        return () => {
            document.removeEventListener('keydown', onTab);
            document.removeEventListener('focusin', onFocusIn);
            if (previous instanceof HTMLElement && previous.isConnected) {
                previous.focus();
            }
        };
    }, [open]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const onKey = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) {
        return null;
    }
    const { min, max, def } = LIMITS.sizePercent;
    const size = `${clampNumber(props.sizePercent, min, max, def)}%`;
    const look = props.look ?? DEFAULT_DIALOG_LOOK;
    return createPortal(
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={props.title || t('live')}
            style={{ ...backdrop, background: look.overlayColor }}
            onClick={onClose}
        >
            <div
                style={{ ...panel, width: size, height: size, background: look.background, fontFamily: look.font }}
                onClick={event => event.stopPropagation()}
            >
                <div style={{ ...header, background: look.headerBackground, fontSize: look.titleSizePx }}>
                    <span style={{ color: look.titleColor }}>{props.title}</span>
                    <button
                        ref={closeRef}
                        type="button"
                        aria-label={t('close')}
                        style={{ ...closeButton, color: look.closeColor }}
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>
                <div style={body}>{props.children}</div>
            </div>
        </div>,
        document.body,
    );
}
