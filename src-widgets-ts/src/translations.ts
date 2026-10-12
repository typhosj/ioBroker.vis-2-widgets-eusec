import de from './lang/de.json';
import en from './lang/en.json';

// vis-2 loads this module for `visWidgets.i18n: "component"`. Other languages fall back to English.
// I18n.extendTranslations() takes { en, de, ... } as one dictionary per language only when en, de
// and ru are all present, so Russian gets the English texts instead of being left out.
const translations = { en, de, ru: en };

export default translations;
