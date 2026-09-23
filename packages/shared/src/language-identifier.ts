/**
 * Forward-compatible language identity. Existing registry codes remain valid;
 * optional BCP 47/region fields can be populated in a later language lot.
 */
export interface LanguageIdentifier {
  /** Existing generic language code, e.g. `fr` or `ar`. */
  code: string;
  /** Optional ISO 3166 region, e.g. `CA`; never inferred from a flag alone. */
  region?: string;
  /** Optional canonical BCP 47 tag, e.g. `fr-CA`. */
  tag?: string;
}

export function languageTag(identifier: LanguageIdentifier): string {
  return identifier.tag ?? (
    identifier.region
      ? `${identifier.code.toLowerCase()}-${identifier.region.toUpperCase()}`
      : identifier.code.toLowerCase()
  );
}
