/**
 * Plugin & Extension Engine (Sprint 10 ⭐).
 *
 * The forward-looking brick: capabilities register as PLUGINS so new spaces,
 * connectors and AI engines can be added without touching the core. The V1 ships
 * the registry + contract + a manifest of what's active today and what's planned
 * (Teacher/School/Career Brains, Google Drive/Moodle/Canvas connectors, …); each
 * future plugin slots in by registering a manifest — no core-code change.
 */

/** What a plugin extends. */
export type PluginKind = 'space' | 'connector' | 'ai-engine';

/** Where a plugin is in its lifecycle. */
export type PluginStatus = 'active' | 'available' | 'planned';

/** A registered plugin's public description. */
export interface PluginManifest {
  id: string;
  name: string;
  kind: PluginKind;
  description: string;
  status: PluginStatus;
  /** Optional: what it needs to become active (a key, an OAuth grant, …). */
  requires?: string;
}

/** The full plugin catalog for the Extensions screen. */
export interface PluginCatalog {
  plugins: PluginManifest[];
  /** The extension points a plugin can register against. */
  extensionPoints: string[];
}
