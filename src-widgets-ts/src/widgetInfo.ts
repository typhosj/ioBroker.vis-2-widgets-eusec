import type {
    RxWidgetInfo,
    RxWidgetInfoAttributesField,
    RxWidgetInfoAttributesFieldID,
    RxWidgetInfoGroup,
} from '@iobroker/types-vis-2';

import { I18N_PREFIX } from './i18n';
import { LIMITS, clampNumber, cssValue } from './lib/attrs';

export type PtzMode = 'hover' | 'always' | 'never';

/** Player attributes shared by all three widgets. */
export interface PlayerSettings {
    /** Play the sound of the camera. */
    audio: boolean;
    /** Raw player mode attribute. */
    mode: unknown;
    /** Raw start timeout attribute (s). */
    startTimeoutS: unknown;
    /** When the pan and tilt controls show. */
    ptz: PtzMode;
    /** Raw repeat interval attribute (ms). */
    ptzRepeatMs: unknown;
}

const label = (key: string): string => `${I18N_PREFIX}${key}`;

/**
 * The widget info every widget of this set shares.
 *
 * @param id Template ID
 * @param widgetLabel Translation key of the widget name, without prefix
 * @param fields Attributes
 * @param groups Further attribute groups after the common one
 * @returns The widget info
 */
export function createInfo(
    id: string,
    widgetLabel: string,
    fields: RxWidgetInfoAttributesField[],
    groups: RxWidgetInfoGroup[] = [],
): RxWidgetInfo {
    return {
        id,
        visSet: 'vis-2-widgets-eusec',
        visSetLabel: label('set'),
        visSetColor: '#0099d8',
        visName: id,
        visWidgetLabel: label(widgetLabel),
        visPrev: '',
        visAttrs: [{ name: 'common', fields }, ...groups],
    };
}

export const deviceField: RxWidgetInfoAttributesFieldID = {
    name: 'device',
    label: label('device'),
    type: 'id',
    filter: { type: 'channel' },
    noSubscribe: true,
    noInit: true,
};

export const playerFields: RxWidgetInfoAttributesField[] = [
    { name: 'audio', label: label('audio'), type: 'checkbox', default: false },
    {
        name: 'startTimeout',
        label: label('startTimeout'),
        type: 'number',
        min: LIMITS.startTimeoutS.min,
        max: LIMITS.startTimeoutS.max,
        default: LIMITS.startTimeoutS.def,
    },
    {
        name: 'ptz',
        label: label('ptz'),
        type: 'select',
        options: [
            { value: 'hover', label: label('ptz_hover') },
            { value: 'always', label: label('ptz_always') },
            { value: 'never', label: label('ptz_never') },
        ],
        default: 'hover',
    },
    {
        name: 'ptzRepeat',
        label: label('ptzRepeat'),
        type: 'number',
        min: LIMITS.ptzRepeatMs.min,
        max: LIMITS.ptzRepeatMs.max,
        default: LIMITS.ptzRepeatMs.def,
    },
    { name: 'mode', label: label('mode'), type: 'text', default: 'mse' },
];

/**
 * Reads the pan and tilt attribute.
 *
 * @param value Attribute value
 * @returns The mode, `hover` for anything unknown
 */
export function ptzMode(value: unknown): PtzMode {
    return value === 'always' || value === 'never' ? value : 'hover';
}

/**
 * The player attributes of a widget's rxData.
 *
 * @param data rxData of the widget
 * @returns The settings for LivePlayer
 */
export function playerProps(data: Record<string, unknown>): PlayerSettings {
    return {
        audio: data.audio === true,
        mode: data.mode,
        startTimeoutS: data.startTimeout,
        ptz: ptzMode(data.ptz),
        ptzRepeatMs: data.ptzRepeat,
    };
}

/** Colours and fonts of the livestream dialog of the popup and the snapshot. */
export interface DialogLook {
    /** Backdrop around the dialog. */
    overlayColor: string;
    /** Dialog behind the player. */
    background: string;
    /** Header bar. */
    headerBackground: string;
    /** Title text. */
    titleColor: string;
    /** Font family of the whole dialog, notices of the player included. */
    font: string;
    /** Title size in px. */
    titleSizePx: number;
    /** Close button. */
    closeColor: string;
}

/** The look before the attributes existed; widgets saved back then keep it. */
export const DEFAULT_DIALOG_LOOK: DialogLook = {
    overlayColor: 'rgba(0, 0, 0, 0.6)',
    background: '#000',
    headerBackground: '#111',
    titleColor: '#fff',
    font: 'sans-serif',
    titleSizePx: 16,
    closeColor: '#fff',
};

const colorField = (name: string, def: string): RxWidgetInfoAttributesField => ({
    name,
    label: label(name),
    type: 'color',
    default: def,
});

/** Attributes of the dialog group: title, size, colours and fonts. */
export const dialogFields: RxWidgetInfoAttributesField[] = [
    { name: 'title', label: label('title'), type: 'text' },
    {
        name: 'size',
        label: label('size'),
        type: 'number',
        min: LIMITS.sizePercent.min,
        max: LIMITS.sizePercent.max,
        default: LIMITS.sizePercent.def,
    },
    colorField('dialogOverlay', DEFAULT_DIALOG_LOOK.overlayColor),
    colorField('dialogBackground', DEFAULT_DIALOG_LOOK.background),
    colorField('dialogHeader', DEFAULT_DIALOG_LOOK.headerBackground),
    colorField('dialogTitleColor', DEFAULT_DIALOG_LOOK.titleColor),
    colorField('dialogCloseColor', DEFAULT_DIALOG_LOOK.closeColor),
    { name: 'dialogFont', label: label('dialogFont'), type: 'fontname' },
    {
        name: 'dialogTitleSize',
        label: label('dialogTitleSize'),
        type: 'number',
        min: LIMITS.titleSizePx.min,
        max: LIMITS.titleSizePx.max,
        default: LIMITS.titleSizePx.def,
    },
];

/** The dialog group for createInfo(). */
export const dialogGroup: RxWidgetInfoGroup = { name: 'dialog', label: label('group_dialog'), fields: dialogFields };

/**
 * The dialog look of a widget's rxData, with the default for every unusable attribute.
 *
 * @param data rxData of the widget
 * @returns The look for LiveDialog
 */
export function dialogLook(data: Record<string, unknown>): DialogLook {
    const def = DEFAULT_DIALOG_LOOK;
    const { min, max } = LIMITS.titleSizePx;
    return {
        overlayColor: cssValue(data.dialogOverlay, 'color', def.overlayColor),
        background: cssValue(data.dialogBackground, 'color', def.background),
        headerBackground: cssValue(data.dialogHeader, 'color', def.headerBackground),
        titleColor: cssValue(data.dialogTitleColor, 'color', def.titleColor),
        font: cssValue(data.dialogFont, 'font-family', def.font),
        titleSizePx: clampNumber(data.dialogTitleSize, min, max, def.titleSizePx),
        closeColor: cssValue(data.dialogCloseColor, 'color', def.closeColor),
    };
}
