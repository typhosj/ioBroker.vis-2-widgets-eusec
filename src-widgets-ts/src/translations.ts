import de from './lang/de.json';
import en from './lang/en.json';
import es from './lang/es.json';
import fr from './lang/fr.json';
import it from './lang/it.json';
import nl from './lang/nl.json';
import pl from './lang/pl.json';
import pt from './lang/pt.json';
import ru from './lang/ru.json';
import uk from './lang/uk.json';
import zhCn from './lang/zh-cn.json';

// vis-2 loads this module for `visWidgets.i18n: "component"`. I18n.extendTranslations() takes
// { en, de, ... } as one dictionary per language only when en, de and ru are all present.
const translations = { en, de, ru, pt, nl, fr, it, es, pl, uk, 'zh-cn': zhCn };

export default translations;
