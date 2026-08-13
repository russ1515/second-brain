import { Injectable } from '@nestjs/common';
import type { PluginCatalog, PluginManifest } from '@second-brain/shared';

/** The extension points a plugin can hook into. Real plugins register a manifest
 *  plus their contributions (routes, nav entries, AI providers, connectors). */
const EXTENSION_POINTS = [
  'space', // a new learner space / "Brain"
  'connector', // an external content source
  'ai-engine', // an additional LLM/AI backend (see the AI Orchestrator, 10.6)
];

/**
 * Plugin & Extension registry (Sprint 10 ⭐).
 *
 * A single place capabilities register themselves, so Second Brain can grow —
 * new spaces, connectors, AI engines — without editing the core. The V1 seeds
 * the registry with what ships today (marked `active`) and the roadmap (marked
 * `planned` / `available`), and exposes `register()` so a future plugin slots in
 * by calling it once at boot. Nothing here needs to change to add a plugin.
 */
@Injectable()
export class PluginRegistry {
  private readonly plugins = new Map<string, PluginManifest>();

  constructor() {
    this.seed();
  }

  /** Register (or replace) a plugin. A future plugin calls this at startup. */
  register(manifest: PluginManifest): void {
    this.plugins.set(manifest.id, manifest);
  }

  catalog(): PluginCatalog {
    const order = { active: 0, available: 1, planned: 2 } as const;
    const plugins = [...this.plugins.values()].sort(
      (a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name),
    );
    return { plugins, extensionPoints: EXTENSION_POINTS };
  }

  /** Everything the V1 knows about — active features framed as plugins, plus the
   *  roadmap. Adding a real plugin later is one more `register()` call. */
  private seed(): void {
    const builtins: PluginManifest[] = [
      // The current app, framed as the core space plugin.
      { id: 'personal-brain', name: 'Personal Brain', kind: 'space', status: 'active', description: 'The personal learning OS: twin, tutor, revision, library.' },
      { id: 'ai-gemini', name: 'Google Gemini', kind: 'ai-engine', status: 'active', description: 'The default generative AI backend, via the orchestrator.' },
      { id: 'ai-echo', name: 'Echo (offline)', kind: 'ai-engine', status: 'active', description: 'A zero-cost offline backend for cost/speed strategies.' },

      // Roadmap AI engines (interchangeable via the 10.6 orchestrator).
      { id: 'ai-openai', name: 'OpenAI', kind: 'ai-engine', status: 'available', description: 'Add GPT-class models.', requires: 'OPENAI_API_KEY + adapter' },
      { id: 'ai-claude', name: 'Anthropic Claude', kind: 'ai-engine', status: 'available', description: 'Add Claude models.', requires: 'ANTHROPIC_API_KEY + adapter' },
      { id: 'ai-mistral', name: 'Mistral', kind: 'ai-engine', status: 'available', description: 'Add Mistral models.', requires: 'MISTRAL_API_KEY + adapter' },

      // Roadmap spaces / "Brains".
      { id: 'teacher-brain', name: 'Teacher Brain', kind: 'space', status: 'planned', description: 'A space for teachers to author and track classes.' },
      { id: 'school-brain', name: 'School Brain', kind: 'space', status: 'planned', description: 'Institution-wide learning management.' },
      { id: 'career-brain', name: 'Career Brain', kind: 'space', status: 'planned', description: 'Skills and career-path learning.' },
      { id: 'enterprise-brain', name: 'Enterprise Brain', kind: 'space', status: 'planned', description: 'Corporate training at scale.' },
      { id: 'team-brain', name: 'Team Brain', kind: 'space', status: 'planned', description: 'Shared learning for a team.' },
      { id: 'research-brain', name: 'Research Brain', kind: 'space', status: 'planned', description: 'Literature-heavy research workflows.' },

      // Roadmap connectors.
      { id: 'connector-gdrive', name: 'Google Drive', kind: 'connector', status: 'planned', description: 'Import documents from Google Drive.', requires: 'OAuth grant' },
      { id: 'connector-onedrive', name: 'OneDrive', kind: 'connector', status: 'planned', description: 'Import from OneDrive.', requires: 'OAuth grant' },
      { id: 'connector-dropbox', name: 'Dropbox', kind: 'connector', status: 'planned', description: 'Import from Dropbox.', requires: 'OAuth grant' },
      { id: 'connector-moodle', name: 'Moodle', kind: 'connector', status: 'planned', description: 'Sync courses from Moodle.', requires: 'API token' },
      { id: 'connector-canvas', name: 'Canvas', kind: 'connector', status: 'planned', description: 'Sync courses from Canvas LMS.', requires: 'API token' },
    ];
    builtins.forEach((p) => this.register(p));
  }
}
