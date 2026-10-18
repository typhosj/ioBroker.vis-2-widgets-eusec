import { describe, expect, it } from 'vitest';

import translations from './translations';

const LANGUAGES = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'zh-cn'];
const dictionaries = translations as Record<string, Record<string, string>>;
const placeholders = (text: string): number => text.split('%s').length - 1;

// Texts that stay the same as in English on purpose: the brand, and words the language takes over.
const SAME_AS_ENGLISH: Record<string, string[]> = {
    de: ['vis_2_widgets_eusec_group_dialog', 'vis_2_widgets_eusec_live', 'vis_2_widgets_eusec_set'],
    nl: [
        'vis_2_widgets_eusec_device',
        'vis_2_widgets_eusec_live',
        'vis_2_widgets_eusec_set',
        'vis_2_widgets_eusec_trigger1',
        'vis_2_widgets_eusec_trigger2',
        'vis_2_widgets_eusec_trigger3',
    ],
};

describe('translations', () => {
    it('has the shape vis-2 takes as a dictionary per language', () => {
        // I18n.extendTranslations() reads { en, de, ... } per language only when en, de AND ru
        // exist; otherwise it takes every key of en as a language and drops all texts.
        expect(Object.keys(translations).sort()).toEqual(LANGUAGES);
    });

    it('translates every key in every language, with the same placeholders', () => {
        const english = dictionaries.en;
        for (const language of LANGUAGES) {
            const dictionary = dictionaries[language];
            expect(Object.keys(dictionary).sort(), language).toEqual(Object.keys(english).sort());
            for (const [key, text] of Object.entries(dictionary)) {
                expect(text.trim(), `${language} ${key}`).not.toBe('');
                expect(placeholders(text), `${language} ${key}`).toBe(placeholders(english[key]));
            }
        }
    });

    it('leaves no text in English by accident', () => {
        const english = dictionaries.en;
        for (const language of LANGUAGES.filter(language => language !== 'en')) {
            const same = Object.keys(english)
                .filter(key => dictionaries[language][key] === english[key])
                .sort();
            expect(same, language).toEqual(SAME_AS_ENGLISH[language] ?? ['vis_2_widgets_eusec_set']);
        }
    });

    it('uses the prefix of the widget set for every key', () => {
        for (const key of Object.keys(translations.en)) {
            expect(key.startsWith('vis_2_widgets_eusec_')).toBe(true);
        }
    });
});
