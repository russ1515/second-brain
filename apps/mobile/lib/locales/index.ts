/**
 * Locale resources barrel (scalable i18n).
 *
 * Importing this once (in app/_layout) registers every generated UI dictionary.
 * Complete catalogs give a fully translated UI; partial ones give what's
 * translated + English fallback for the rest. Add a language by generating its
 * file (`node scripts/translate-locale.mjs <code>`) and adding one line here.
 */
// Full (1312/1312):
import './es'; // Spanish
import './de'; // German
import './it'; // Italian
import './pt'; // Portuguese
import './hi'; // Hindi
import './tr'; // Turkish
import './pl'; // Polish
import './ru'; // Russian
import './zh'; // Chinese
import './vi'; // Vietnamese
// Partial (translated so far + English fallback — finish via translate-locale.mjs):
import './ja'; // Japanese
import './sv'; // Swedish
import './th'; // Thai
import './ar'; // Arabic
import './ko'; // Korean
import './nl'; // Dutch
import './el'; // Greek
import './cs'; // Czech
import './ro'; // Romanian
import './hu'; // Hungarian
import './da'; // Danish
import './fi'; // Finnish
import './id'; // Indonesian
import './no'; // Norwegian
import './uk'; // Ukrainian
