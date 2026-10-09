import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { t } from './i18n';
import { LIMITS, clampNumber } from './lib/attrs';

/** Props of LiveDialog. */
export interface LiveDialogProps {
    /** Show the dialog. */
    open: boolean;
    /** Header text. */
    title: string;
    /** Raw size attribute (% of the screen). */
    sizePercent: unknown;
    /** Close button, backdrop or Escape. */
    onClose: () => void;
    /** Dialog content. */
    children: React.ReactNode;
}

const backdrop: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
const panel: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    background: '#000',
    borderRadius: 8,
    overflow: 'hidden',
};
const header: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px',
    background: '#111',
    color: '#fff',
    font: '16px sans-serif',
};
const closeButton: React.CSSProperties = {
    minWidth: 44,
    height: 44,
    border: 0,
    background: 'transparent',
    color: '#fff',
    fontSize: 22,
    cursor: 'pointer',
};
const body: React.CSSProperties = { position: 'relative', flex: 1 };

/**
 * A full-screen (or sized) dialog above the whole vis page, closed by button, backdrop or Escape.
 *
 * @param props Open state, title, size, close handler and content
 * @returns The dialog, or null while closed
 */
export function LiveDialog(props: LiveDialogProps): React.JSX.Element | null {
    const { open, onClose } = props;
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
    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={props.title || t('live')}
            style={backdrop}
            onClick={onClose}
        >
            <div
                style={{ ...panel, width: size, height: size }}
                onClick={event => event.stopPropagation()}
            >
                <div style={header}>
                    <span>{props.title}</span>
                    <button
                        type="button"
                        aria-label={t('close')}
                        style={closeButton}
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
