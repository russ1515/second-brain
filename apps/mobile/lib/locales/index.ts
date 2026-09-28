/**
 * Locale resources barrel (scalable i18n).
 *
 * Importing this once (in app/_layout) registers every generated UI dictionary.
 * Complete catalogs become selectable. Partial catalogs remain registered for
 * translation work but are not exposed as a finished interface language.
 * Add a language by generating its file (`node scripts/translate-locale.mjs
 * <code>`) and adding one line here.
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
import './no'; // Norwegian Bokmål (`nb`; legacy file name)
import './uk'; // Ukrainian
import './ln'; // Lingala
import './sw'; // Swahili
import './wo'; // Wolof
import './ha'; // Hausa
import './he'; // Hebrew
import './zh-Hant'; // Traditional Chinese
import './bn'; // Bengali

// Reviewed essentials are layered last so generated catalogs can be refreshed
// safely without losing the controls required to select/recover a locale.
import './essential';
import './review';
