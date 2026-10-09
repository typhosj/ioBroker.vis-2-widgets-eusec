import de from './lang/de.json';
import en from './lang/en.json';

// vis-2 loads this module for `visWidgets.i18n: "component"`. Other languages fall back to English.
const translations = { en, de };

export default translations;
