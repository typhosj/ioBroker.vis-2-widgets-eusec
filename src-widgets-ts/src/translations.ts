import de from './i18n/de.json';
import en from './i18n/en.json';

// vis-2 loads this module for `visWidgets.i18n: "component"`. Other languages fall back to English.
const translations = { en, de };

export default translations;
