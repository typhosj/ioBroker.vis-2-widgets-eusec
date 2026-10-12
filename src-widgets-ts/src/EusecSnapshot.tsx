import React, { useCallback, useEffect, useState } from 'react';
import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

import { I18N_PREFIX, t } from './i18n';
import { parseDeviceChannel } from './lib/device';
import { type LinkSocket, pictureUrl } from './lib/deviceLink';
import { relativeTime } from './lib/relativeTime';
import { LiveDialog } from './LiveDialog';
import { LivePlayer } from './LivePlayer';
import {
    type DialogLook,
    type PlayerSettings,
    createInfo,
    deviceField,
    dialogGroup,
    dialogLook,
    playerFields,
    playerProps,
} from './widgetInfo';

/** How often "3 minutes ago" is recomputed. */
const CLOCK_MS = 30_000;

/** Props of SnapshotTile. */
export interface SnapshotTileProps {
    /** vis-2 socket. */
    socket: LinkSocket;
    /** Value of the device attribute. */
    channelId: unknown;
    /** A tap opens the livestream in a dialog. */
    tapOpensLive: boolean;
    /** Raw title attribute of the dialog. */
    title: unknown;
    /** Raw size attribute of the dialog (% of the screen). */
    sizePercent: unknown;
    /** Colours and fonts of the dialog. */
    look?: DialogLook;
    /** The vis-2 editor is open. */
    editMode: boolean;
    /** vis-2 language. */
    language: string;
    /** Player attributes for the dialog. */
    player: PlayerSettings;
}

const tile: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: '#222',
    color: '#ddd',
    font: '13px sans-serif',
};
const image: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
};
const caption: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '4px 8px',
    background: 'rgba(0, 0, 0, 0.55)',
    color: '#fff',
};
const empty: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
};

/**
 * The last picture of a camera and its age; a tap opens the livestream.
 *
 * @param props Socket, camera and dialog settings
 * @returns The tile
 */
export function SnapshotTile(props: SnapshotTileProps): React.JSX.Element {
    const device = parseDeviceChannel(props.channelId);
    const pictureId = device ? `${device.channelId}.picture_url` : '';
    const [picture, setPicture] = useState({ url: '', changedAt: 0 });
    const [now, setNow] = useState(() => Date.now());
    const [open, setOpen] = useState(false);
    const { socket } = props;

    useEffect(() => {
        setPicture({ url: '', changedAt: 0 });
        if (!pictureId) {
            return undefined;
        }
        const handler: ioBroker.StateChangeHandler = (_id, state) =>
            setPicture({ url: pictureUrl(state?.val), changedAt: typeof state?.lc === 'number' ? state.lc : 0 });
        socket
            .subscribeState(pictureId, handler)
            .catch((error: unknown) => console.warn(`vis2-eusec: cannot subscribe ${pictureId}: ${String(error)}`));
        return () => socket.unsubscribeState(pictureId, handler);
    }, [socket, pictureId]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
        return () => clearInterval(timer);
    }, []);

    const close = useCallback(() => setOpen(false), []);
    const canOpen = props.tapOpensLive && !props.editMode && device !== null;
    const when = relativeTime(picture.changedAt, now, props.language);

    return (
        <>
            <div
                style={{ ...tile, cursor: canOpen ? 'pointer' : 'default' }}
                role={canOpen ? 'button' : undefined}
                tabIndex={canOpen ? 0 : undefined}
                aria-label={canOpen ? t('live') : undefined}
                onClick={canOpen ? () => setOpen(true) : undefined}
                onKeyDown={canOpen ? event => (event.key === 'Enter' || event.key === ' ') && setOpen(true) : undefined}
            >
                {picture.url ? (
                    <img
                        src={`${picture.url}${picture.url.includes('?') ? '&' : '?'}t=${picture.changedAt}`}
                        alt=""
                        style={image}
                    />
                ) : (
                    <div style={empty}>
                        <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                            />
                        </svg>
                        <span>{device ? t('noPicture') : t('noDevice')}</span>
                    </div>
                )}
                {when ? <div style={caption}>{when}</div> : null}
            </div>
            <LiveDialog
                open={open}
                title={typeof props.title === 'string' ? props.title : ''}
                sizePercent={props.sizePercent}
                look={props.look}
                onClose={close}
            >
                <LivePlayer
                    socket={socket}
                    channelId={props.channelId}
                    active
                    {...props.player}
                />
            </LiveDialog>
        </>
    );
}

const Base: typeof VisRxWidget<Record<string, unknown>> = window.visRxWidget;

/** Last picture of a camera; a tap opens the livestream. */
export default class EusecSnapshot extends Base {
    /** Attributes and name of the widget in the vis-2 editor. */
    static getWidgetInfo(): RxWidgetInfo {
        return createInfo(
            'tplVis2EusecSnapshot',
            'snapshot_widget',
            [
                deviceField,
                { name: 'tapOpensLive', label: `${I18N_PREFIX}tapOpensLive`, type: 'checkbox', default: true },
                ...playerFields,
            ],
            [dialogGroup],
        );
    }

    /** Instance access to the static widget info, which vis-2 calls. */
    getWidgetInfo(): RxWidgetInfo {
        return EusecSnapshot.getWidgetInfo();
    }

    /**
     * Renders the tile.
     *
     * @param props Render props of vis-2
     */
    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const data = this.state.rxData;
        return (
            <SnapshotTile
                socket={this.props.context.socket}
                channelId={data.device}
                tapOpensLive={data.tapOpensLive !== false}
                title={data.title}
                sizePercent={data.size}
                look={dialogLook(data)}
                editMode={!!this.props.editMode}
                language={Base.getLanguage()}
                player={playerProps(data)}
            />
        );
    }
}
