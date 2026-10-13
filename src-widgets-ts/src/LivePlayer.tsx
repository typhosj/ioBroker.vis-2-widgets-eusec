import React, { useEffect, useMemo, useRef, useState } from 'react';

import { t } from './i18n';
import { LIMITS, clampNumber } from './lib/attrs';
import { type Capabilities, parseDeviceChannel, playerSrc } from './lib/device';
import { DeviceLink, type LinkSocket } from './lib/deviceLink';
import { readPlayerEvent } from './lib/playerMessage';
import { StreamController, type StreamView } from './lib/streamControl';
import { PtzOverlay } from './PtzOverlay';
import type { PlayerSettings } from './widgetInfo';

/** Props of LivePlayer. */
export interface LivePlayerProps extends PlayerSettings {
    /** vis-2 socket. */
    socket: LinkSocket;
    /** Value of the device attribute. */
    channelId: unknown;
    /** False in the vis-2 editor: never start a stream there. */
    active: boolean;
}

type LinkState = { status: 'loading' } | { status: 'notFound' } | { status: 'ready'; caps: Capabilities };

const IDLE_VIEW: StreamView = { phase: 'idle', iframeSrc: null, placeholder: true };

const root: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: '#000',
};
const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 };
const status: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 3,
    padding: '6px 10px',
    background: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    // The font of the surrounding dialog or widget.
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
};
const retryButton: React.CSSProperties = {
    border: '1px solid #fff',
    borderRadius: 4,
    background: 'transparent',
    color: '#fff',
    padding: '2px 8px',
    cursor: 'pointer',
};

function statusText(hasDevice: boolean, link: LinkState, view: StreamView): string | null {
    if (!hasDevice) {
        return t('noDevice');
    }
    if (link.status === 'notFound') {
        return t('notFound');
    }
    if (link.status === 'loading') {
        return null;
    }
    if (link.caps.mixedContent) {
        return t('mixedContent');
    }
    switch (view.notice) {
        case 'notRunning':
            return t('notRunning');
        case 'timeout':
            return t('timeout');
        case 'ended':
            return t('ended');
        case 'waiting':
            return t('waiting', view.detail ?? '');
        case 'unreachable':
            return t('unreachable', view.detail ?? '');
        case 'error':
            return t('error', view.detail ?? '');
        default:
            return view.phase === 'starting' ? t('starting') : null;
    }
}

function withVersion(url: string, changedAt: number): string {
    // eusec overwrites the same file for every event; the version makes the browser load the new one.
    return `${url}${url.includes('?') ? '&' : '?'}t=${changedAt}`;
}

/**
 * The livestream of one camera, with snapshot placeholder, status line and pan and tilt controls.
 *
 * @param props Socket, camera and player settings
 * @returns The player
 */
export function LivePlayer(props: LivePlayerProps): React.JSX.Element {
    const device = useMemo(() => parseDeviceChannel(props.channelId), [props.channelId]);
    const [link, setLink] = useState<LinkState>({ status: 'loading' });
    const [view, setView] = useState<StreamView>(IDLE_VIEW);
    const [picture, setPicture] = useState({ url: '', changedAt: 0 });
    const [inView, setInView] = useState(true);
    const [pageVisible, setPageVisible] = useState(() => !document.hidden);
    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const linkRef = useRef<DeviceLink | null>(null);
    const controllerRef = useRef<StreamController | null>(null);
    const liveRef = useRef(false);
    const aliveRef = useRef(true);

    useEffect(() => {
        setLink({ status: 'loading' });
        if (!device) {
            return undefined;
        }
        const deviceLink = new DeviceLink(
            props.socket,
            device,
            { protocol: location.protocol, hostname: location.hostname },
            {
                onLivestream: active => {
                    liveRef.current = active;
                    controllerRef.current?.livestreamChanged(active);
                },
                onAlive: alive => {
                    aliveRef.current = alive;
                    controllerRef.current?.setAlive(alive);
                },
                onPicture: (url, changedAt) => setPicture({ url, changedAt }),
            },
        );
        linkRef.current = deviceLink;
        deviceLink.open().then(
            caps => {
                if (linkRef.current === deviceLink) {
                    setLink(caps ? { status: 'ready', caps } : { status: 'notFound' });
                }
            },
            () => {
                if (linkRef.current === deviceLink) {
                    setLink({ status: 'notFound' });
                }
            },
        );
        return () => {
            deviceLink.close();
            if (linkRef.current === deviceLink) {
                linkRef.current = null;
            }
        };
    }, [props.socket, device]);

    const caps = link.status === 'ready' ? link.caps : null;
    const { min, max, def } = LIMITS.startTimeoutS;
    const startTimeoutMs = clampNumber(props.startTimeoutS, min, max, def) * 1000;
    const src = caps ? playerSrc(caps, { audio: props.audio, mode: props.mode }) : '';

    useEffect(() => {
        const deviceLink = linkRef.current;
        if (!caps || caps.mixedContent || !deviceLink) {
            return undefined;
        }
        const controller = new StreamController({
            onDemand: caps.onDemand,
            playerEvents: caps.playerEvents,
            src,
            startTimeoutMs,
            // The link captured here, not linkRef: on unmount the link's cleanup runs first and
            // clears the ref, but the controller still has to write stop_stream.
            write: name => deviceLink.write(name, true),
            onView: setView,
        });
        controller.livestreamChanged(liveRef.current);
        controller.setAlive(aliveRef.current);
        controllerRef.current = controller;
        return () => {
            controller.dispose();
            controllerRef.current = null;
            setView(IDLE_VIEW);
        };
    }, [caps, src, startTimeoutMs]);

    const shouldPlay = props.active && inView && pageVisible;
    useEffect(() => {
        const controller = controllerRef.current;
        if (!controller) {
            return;
        }
        if (shouldPlay) {
            controller.show();
        } else {
            controller.hide();
        }
    }, [shouldPlay, caps, src, startTimeoutMs]);

    useEffect(() => {
        const element = containerRef.current;
        // Without IntersectionObserver (old WebView, jsdom) the widget counts as visible.
        if (!element || typeof IntersectionObserver === 'undefined') {
            return undefined;
        }
        const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const onChange = (): void => setPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', onChange);
        return () => document.removeEventListener('visibilitychange', onChange);
    }, []);

    useEffect(() => {
        if (!caps) {
            return undefined;
        }
        const onMessage = (event: MessageEvent): void => {
            const playerEvent = readPlayerEvent(event, {
                origin: caps.playerBaseUrl,
                window: iframeRef.current?.contentWindow,
                src: caps.streamName,
            });
            if (playerEvent) {
                controllerRef.current?.playerEvent(playerEvent);
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [caps]);

    const text = statusText(device !== null, link, view);
    const { min: repeatMin, max: repeatMax, def: repeatDef } = LIMITS.ptzRepeatMs;
    return (
        <div
            ref={containerRef}
            style={root}
        >
            {view.iframeSrc ? (
                <iframe
                    ref={iframeRef}
                    src={view.iframeSrc}
                    title={t('live')}
                    allow="autoplay; fullscreen"
                    // The origin comes from the livestream state. The page may run its player in its
                    // own origin, but neither navigate the vis page nor open popups.
                    sandbox="allow-scripts allow-same-origin"
                    style={fill}
                    onLoad={() => controllerRef.current?.iframeLoaded()}
                />
            ) : null}
            {view.placeholder && picture.url ? (
                <img
                    src={withVersion(picture.url, picture.changedAt)}
                    alt=""
                    style={{ ...fill, objectFit: 'cover' }}
                />
            ) : null}
            {caps?.ptz && props.ptz !== 'never' && props.active ? (
                <PtzOverlay
                    mode={props.ptz}
                    presets={caps.presets}
                    repeatMs={clampNumber(props.ptzRepeatMs, repeatMin, repeatMax, repeatDef)}
                    write={(name, val) => linkRef.current?.write(name, val)}
                />
            ) : null}
            {text ? (
                <div
                    role="status"
                    style={status}
                >
                    <span>{text}</span>
                    {view.phase === 'error' && view.notice !== 'notRunning' ? (
                        <button
                            type="button"
                            style={retryButton}
                            onClick={() => controllerRef.current?.retry()}
                        >
                            {t('retry')}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
