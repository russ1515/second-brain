/**
 * Locale resources barrel (scalable i18n).
 *
 * Importing this once (in app/_layout) registers every generated UI dictionary.
 * Complete catalogs give a fully translated UI; partial ones give what's
 * translated + English fallback for the rest. Add a language by generating its
 * file (`node scripts/translate-locale.mjs <code>`) and adding one line here.
 */
// Generated partial catalogs. Coverage is computed at runtime against the
// current English source catalog; missing copy always falls back to English.
// Do not label a locale "full" here: the source catalog evolves continuously.
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

// Reviewed essentials are layered last so generated catalogs can be refreshed
// safely without losing the controls required to select/recover a locale.
import './essential';
import './review';
