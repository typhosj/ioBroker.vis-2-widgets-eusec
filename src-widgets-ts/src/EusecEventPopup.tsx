import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RxRenderWidgetProps, RxWidgetInfo, RxWidgetInfoAttributesField } from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

import { I18N_PREFIX, t } from './i18n';
import { LIMITS, clampNumber } from './lib/attrs';
import { parseDeviceChannel } from './lib/device';
import type { LinkSocket } from './lib/deviceLink';
import { AutoClose, DEFAULT_TRIGGERS, TriggerWatcher, validTriggers } from './lib/trigger';
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

/** Props of EventPopup. */
export interface EventPopupProps {
    /** vis-2 socket. */
    socket: LinkSocket;
    /** Value of the device attribute. */
    channelId: unknown;
    /** Values of the trigger attributes. */
    triggers: readonly unknown[];
    /** Raw close-after attribute (s). */
    closeAfterS: unknown;
    /** Raw size attribute (% of the screen). */
    sizePercent: unknown;
    /** Raw title attribute. */
    title: unknown;
    /** Colours and fonts of the dialog. */
    look?: DialogLook;
    /** The vis-2 editor is open. */
    editMode: boolean;
    /** Player attributes. */
    player: PlayerSettings;
}

const editorBox: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px dashed #888',
    color: '#888',
    font: '12px sans-serif',
    textAlign: 'center',
};

/**
 * The default triggers of a camera: those of DEFAULT_TRIGGERS that exist below its channel.
 *
 * @param channelId Value of the device attribute
 * @param exists Whether an object exists
 * @returns The trigger IDs, or null for an unusable channel
 */
export async function prefillTriggers(
    channelId: unknown,
    exists: (id: string) => Promise<boolean>,
): Promise<string[] | null> {
    const device = parseDeviceChannel(channelId);
    if (!device) {
        return null;
    }
    const found: string[] = [];
    for (const name of DEFAULT_TRIGGERS) {
        const id = `${device.channelId}.${name}`;
        if (await exists(id)) {
            found.push(id);
        }
    }
    return found;
}

/**
 * Invisible until a trigger fires, then the livestream in a dialog that closes after a while.
 *
 * @param props Socket, camera, triggers and dialog settings
 * @returns The dialog, or a marker in the editor
 */
export function EventPopup(props: EventPopupProps): React.JSX.Element | null {
    const [open, setOpen] = useState(false);
    const autoCloseRef = useRef<AutoClose | null>(null);
    const { min, max, def } = LIMITS.closeAfterS;
    const closeAfterMs = clampNumber(props.closeAfterS, min, max, def) * 1000;
    const triggerKey = validTriggers(props.triggers).join('\n');
    const { socket, editMode } = props;

    useEffect(() => {
        if (editMode || !triggerKey) {
            return undefined;
        }
        const ids = triggerKey.split('\n');
        const autoClose = new AutoClose(closeAfterMs, setOpen);
        autoCloseRef.current = autoClose;
        // A trigger that turned true while another view was shown still opens, as long as it is recent.
        const watcher = new TriggerWatcher(() => autoClose.fire(), closeAfterMs);
        // socket-client calls the handler once with the current value - the watcher's baseline.
        const handler: ioBroker.StateChangeHandler = (id, state) => watcher.update(id, state);
        for (const id of ids) {
            socket
                .subscribeState(id, handler)
                .catch((error: unknown) =>
                    console.warn(`vis-2-widgets-eusec: cannot subscribe ${id}: ${String(error)}`),
                );
        }
        return () => {
            for (const id of ids) {
                socket.unsubscribeState(id, handler);
            }
            autoClose.dispose();
            autoCloseRef.current = null;
            setOpen(false);
        };
    }, [socket, editMode, triggerKey, closeAfterMs]);

    const close = useCallback(() => {
        if (autoCloseRef.current) {
            autoCloseRef.current.close();
        } else {
            setOpen(false);
        }
    }, []);

    if (editMode) {
        return <div style={editorBox}>{t('popupPlaceholder')}</div>;
    }
    return (
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
    );
}

const triggerField = (index: number): RxWidgetInfoAttributesField => ({
    name: `trigger${index}`,
    label: `${I18N_PREFIX}trigger${index}`,
    type: 'id',
    noSubscribe: true,
    noInit: true,
});

const deviceWithPrefill: RxWidgetInfoAttributesField = {
    ...deviceField,
    onChange: async (_field, data, changeData, socket) => {
        if (validTriggers([data.trigger1, data.trigger2, data.trigger3]).length) {
            return;
        }
        const found = await prefillTriggers(data.device, async id => !!(await socket.getObject(id)));
        if (found) {
            changeData({ ...data, trigger1: found[0] ?? '', trigger2: found[1] ?? '' });
        }
    },
};

const Base: typeof VisRxWidget<Record<string, unknown>> = window.visRxWidget;

/** Opens the livestream of a camera when a trigger state turns true. */
export default class EusecEventPopup extends Base {
    /** Attributes and name of the widget in the vis-2 editor. */
    static getWidgetInfo(): RxWidgetInfo {
        return createInfo(
            'tplVis2EusecEventPopup',
            'popup_widget',
            [
                deviceWithPrefill,
                triggerField(1),
                triggerField(2),
                triggerField(3),
                {
                    name: 'closeAfter',
                    label: `${I18N_PREFIX}closeAfter`,
                    type: 'number',
                    min: LIMITS.closeAfterS.min,
                    max: LIMITS.closeAfterS.max,
                    default: LIMITS.closeAfterS.def,
                },
                ...playerFields,
            ],
            [dialogGroup],
        );
    }

    /** Instance access to the static widget info, which vis-2 calls. */
    getWidgetInfo(): RxWidgetInfo {
        return EusecEventPopup.getWidgetInfo();
    }

    /**
     * Renders the popup.
     *
     * @param props Render props of vis-2
     */
    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | null {
        super.renderWidgetBody(props);
        const data = this.state.rxData;
        return (
            <EventPopup
                socket={this.props.context.socket}
                channelId={data.device}
                triggers={[data.trigger1, data.trigger2, data.trigger3]}
                closeAfterS={data.closeAfter}
                sizePercent={data.size}
                title={data.title}
                look={dialogLook(data)}
                editMode={!!this.props.editMode}
                player={playerProps(data)}
            />
        );
    }
}
