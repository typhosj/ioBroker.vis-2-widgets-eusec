/** Prefix of every key of this widget set in the shared vis-2 dictionary. */
export const I18N_PREFIX = 'vis2_eusec_';

/**
 * Translates a key of this widget set through vis-2, with `%s` placeholders filled in order.
 *
 * @param key Key without prefix
 * @param args Values for the placeholders
 * @returns The text in the language of vis-2
 */
export function t(key: string, ...args: string[]): string {
    return window.visRxWidget.t(`${I18N_PREFIX}${key}`, ...args);
}
