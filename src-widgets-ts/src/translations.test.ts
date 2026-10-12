import { describe, expect, it } from 'vitest';

import translations from './translations';

describe('translations', () => {
    it('has the shape vis-2 takes as a dictionary per language', () => {
        // I18n.extendTranslations() reads { en, de, ... } per language only when en, de AND ru
        // exist; otherwise it takes every key of en as a language and drops all texts.
        expect(Object.keys(translations).sort()).toEqual(['de', 'en', 'ru']);
    });

    it('translates every key in German and gives Russian the English texts', () => {
        const keys = Object.keys(translations.en).sort();
        expect(Object.keys(translations.de).sort()).toEqual(keys);
        expect(translations.ru).toEqual(translations.en);
    });

    it('uses the prefix of the widget set for every key', () => {
        for (const key of Object.keys(translations.en)) {
            expect(key.startsWith('vis2_eusec_')).toBe(true);
        }
    });
});
