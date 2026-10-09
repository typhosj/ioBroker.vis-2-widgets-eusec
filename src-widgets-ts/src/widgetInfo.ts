import type { RxWidgetInfo, RxWidgetInfoAttributesField } from '@iobroker/types-vis-2';

import { I18N_PREFIX } from './i18n';
import { LIMITS } from './lib/attrs';

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
 * @returns The widget info
 */
export function createInfo(id: string, widgetLabel: string, fields: RxWidgetInfoAttributesField[]): RxWidgetInfo {
    return {
        id,
        visSet: 'vis2-eusec',
        visSetLabel: label('set'),
        visSetColor: '#0099d8',
        visName: id,
        visWidgetLabel: label(widgetLabel),
        visPrev: '',
        visAttrs: [{ name: 'common', fields }],
    };
}

export const deviceField: RxWidgetInfoAttributesField = {
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
