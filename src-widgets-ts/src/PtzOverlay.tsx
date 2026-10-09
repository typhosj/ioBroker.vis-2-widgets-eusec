import React, { useEffect, useRef, useState } from 'react';

import { t } from './i18n';
import type { PresetOption } from './lib/device';

/** In "on tap" mode the controls disappear after this long without a touch. */
const HIDE_AFTER_MS = 5000;

/** Props of PtzOverlay. */
export interface PtzOverlayProps {
    /** Show the controls always, or only after a tap. */
    mode: 'hover' | 'always';
    /** Preset buttons. */
    presets: PresetOption[];
    /** Already clamped. */
    repeatMs: number;
    /** Writes a state of the camera. */
    write: (name: string, val: ioBroker.StateValue) => void;
}

const layer: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 2 };
const pad: React.CSSProperties = {
    position: 'absolute',
    left: 8,
    bottom: 8,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 44px)',
    gridTemplateRows: 'repeat(3, 44px)',
    gap: 4,
};
const presetRow: React.CSSProperties = {
    position: 'absolute',
    right: 8,
    bottom: 8,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'flex-end',
    maxWidth: '50%',
};
const button: React.CSSProperties = {
    minWidth: 44,
    height: 44,
    border: 0,
    borderRadius: 22,
    background: 'rgba(0, 0, 0, 0.55)',
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    touchAction: 'none',
};

/**
 * Direction pad, 360° button and preset buttons over the player.
 *
 * @param props Mode, presets, repeat interval and write function
 * @returns The overlay
 */
export function PtzOverlay(props: PtzOverlayProps): React.JSX.Element {
    const [shown, setShown] = useState(props.mode === 'always');
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const repeatTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    const stopRepeat = (): void => {
        clearInterval(repeatTimer.current);
        repeatTimer.current = undefined;
    };
    const keepShown = (): void => {
        if (props.mode !== 'hover') {
            return;
        }
        setShown(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShown(false), HIDE_AFTER_MS);
    };

    useEffect(
        () => () => {
            clearInterval(repeatTimer.current);
            clearTimeout(hideTimer.current);
        },
        [],
    );

    const move = (name: string, glyph: string, labelKey: string, area: string): React.JSX.Element => (
        <button
            type="button"
            aria-label={t(labelKey)}
            style={{ ...button, gridArea: area }}
            onPointerDown={event => {
                event.stopPropagation();
                keepShown();
                props.write(name, true);
                stopRepeat();
                repeatTimer.current = setInterval(() => {
                    keepShown();
                    props.write(name, true);
                }, props.repeatMs);
            }}
            onPointerUp={stopRepeat}
            onPointerLeave={stopRepeat}
            onPointerCancel={stopRepeat}
            // detail 0: a click from the keyboard, which fires no pointer events.
            onClick={event => {
                if (event.detail === 0) {
                    props.write(name, true);
                }
            }}
        >
            {glyph}
        </button>
    );

    const once = (name: string, val: ioBroker.StateValue, content: string, ariaLabel: string): React.JSX.Element => (
        <button
            key={`${name}-${String(val)}`}
            type="button"
            aria-label={ariaLabel}
            style={button}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => {
                event.stopPropagation();
                keepShown();
                props.write(name, val);
            }}
        >
            {content}
        </button>
    );

    return (
        <div
            style={layer}
            onPointerDown={keepShown}
        >
            {shown ? (
                <>
                    <div style={pad}>
                        {move('tilt_up', '▲', 'tiltUp', '1 / 2')}
                        {move('pan_left', '◀', 'panLeft', '2 / 1')}
                        {once('rotate_360', true, '⟳', t('rotate'))}
                        {move('pan_right', '▶', 'panRight', '2 / 3')}
                        {move('tilt_down', '▼', 'tiltDown', '3 / 2')}
                    </div>
                    {props.presets.length ? (
                        <div style={presetRow}>
                            {props.presets.map(preset =>
                                once('preset_position', preset.value, preset.label, preset.label),
                            )}
                        </div>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
