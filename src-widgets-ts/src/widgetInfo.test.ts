import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_DIALOG_LOOK, dialogFields, dialogLook } from './widgetInfo';

describe('dialogLook', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('takes the attributes of the dialog group', () => {
        expect(
            dialogLook({
                dialogOverlay: 'rgba(0,0,0,0.72)',
                dialogBackground: '#243949',
                dialogHeader: '#243949',
                dialogTitleColor: '#eef6fb',
                dialogFont: 'RobotoCondensed-Regular',
                dialogTitleSize: '20',
                dialogCloseColor: '#9bdcf3',
            }),
        ).toEqual({
            overlayColor: 'rgba(0,0,0,0.72)',
            background: '#243949',
            headerBackground: '#243949',
            titleColor: '#eef6fb',
            font: 'RobotoCondensed-Regular',
            titleSizePx: 20,
            closeColor: '#9bdcf3',
        });
    });

    it('keeps the old look for a widget saved before the attributes existed', () => {
        expect(dialogLook({})).toEqual(DEFAULT_DIALOG_LOOK);
        expect(DEFAULT_DIALOG_LOOK).toEqual({
            overlayColor: 'rgba(0, 0, 0, 0.6)',
            background: '#000',
            headerBackground: '#111',
            titleColor: '#fff',
            font: 'sans-serif',
            titleSizePx: 16,
            closeColor: '#fff',
        });
    });

    it('falls back per attribute for values the browser rejects and clamps the title size', () => {
        vi.stubGlobal('CSS', { supports: (_property: string, value: string) => value !== 'kaputt' });
        const look = dialogLook({ dialogBackground: 'kaputt', dialogFont: 'kaputt', dialogTitleSize: 500 });
        expect(look.background).toBe('#000');
        expect(look.font).toBe('sans-serif');
        expect(look.titleSizePx).toBe(48);
        expect(dialogLook({ dialogTitleSize: 2 }).titleSizePx).toBe(10);
        expect(dialogLook({ dialogTitleSize: 'x' }).titleSizePx).toBe(16);
    });

    it('offers every look attribute in the editor, with the old look as default', () => {
        const byName = Object.fromEntries(dialogFields.map(field => [field.name, field]));
        expect(byName.dialogBackground).toMatchObject({ type: 'color', default: '#000' });
        expect(byName.dialogFont).toMatchObject({ type: 'fontname' });
        expect(byName.dialogTitleSize).toMatchObject({ type: 'number', min: 10, max: 48, default: 16 });
        expect(Object.keys(byName)).toEqual([
            'title',
            'size',
            'dialogOverlay',
            'dialogBackground',
            'dialogHeader',
            'dialogTitleColor',
            'dialogCloseColor',
            'dialogFont',
            'dialogTitleSize',
        ]);
    });
});
