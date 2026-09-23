# Second Brain Design System

## Scope

UX-2 Lot 1 converges the existing component libraries without redesigning the
product screens or replacing the current navigation shell. The source of truth
remains the token set in `apps/mobile/lib/design/tokens.ts` and the active theme
from `apps/mobile/lib/design/theme.tsx`.

The public component entry point is `apps/mobile/components/ds/index.ts`.
Direct imports from a focused module remain supported when they reduce bundle
or ownership ambiguity.

## Component families

| Module | Responsibility |
| --- | --- |
| `core.tsx` | Buttons, cards, inputs, progress, alerts and skeletons |
| `layout.tsx` | Page width, headers, sections, responsive grids and split panes |
| `states.tsx` | Loading, processing, partial, stale, offline, quota and error states |
| `sources.tsx` | Internal, Brain and external citations plus source previews |
| `usage.tsx` | Truthful bounded/unlimited usage meters |
| `language.tsx` | Language badges, UI/learning selection and language-learning primitives |
| `ai.tsx` | AI presence and teacher posture |
| `learning.tsx` | Mastery, lessons, exercises, flashcards and knowledge relations |
| `controls.tsx` | Form controls |
| `overlays.tsx` | Dialogs, sheets, drawers, toasts and tooltips |
| `navigation.tsx` | Five-space navigation vocabulary; not the application shell |

## Responsive composition

`resolveResponsiveLayout` is a pure shared model used by `useResponsive`.
Existing fields (`width`, `height`, `columns`, `isTablet`,
`maxContentWidth`) remain compatible. New consumers should prefer semantic
composition fields:

- `compact`: single-column content, sticky actions where the screen owns them;
- `medium`: two-column or stacked composition depending on orientation;
- `wide`: main work area plus optional context rail;
- `contentPadding`: 16 / 24 / 32 according to the composition;
- `isDesktop`: shell/layout decision at 1024 px and above.

`Page`, `PageHeader`, `Section`, `ResponsiveGrid` and `ResponsiveSplit` do not
own scrolling, routing or server state. They can therefore be introduced one
screen at a time and rolled back independently.

## Intelligent states

The state components consume the Lot 0 `UXStateKind` and `AIWorkState`
contracts.

- `SmartLoadingState` never fabricates a percentage.
- `AIWorkStateIndicator` renders a determinate bar only for a determinate
  backend value.
- `SmartErrorState` exposes retry only when both `retryable` and a retry action
  are supplied.
- `SmartState` preserves successful/partial/stale content instead of replacing
  the entire screen unnecessarily.
- State changes are announced with live regions and remain understandable
  without colour or motion.

## Sources and citations

`SourceCitation` is the canonical citation component for documents, Brain and
external sources. A citation becomes a link only when a real `onPress` action
exists. External sources display their provider; a flag or colour is never the
only source indicator. `SourcePreview` adds an excerpt and publication date
without fetching anything by itself.

The earlier `SourceCitation` exported by the Learn component library remains as
a compatibility adapter.

## Usage meter

`UsageMeter` consumes values returned by the backend. It does not contain plan
prices, quota defaults or reset rules. `resolveUsageMeter` centralizes:

- unlimited limits (`null`);
- remaining capacity;
- bounded percentages;
- warning at 80%;
- critical state at or above the actual limit.

Reset information is rendered only when a real `resetAt` value is provided.
The `/usage` screen is the first production consumer.

## Language selector

`LanguageSelector` supports all 27 existing registry entries and keeps the
registry unchanged. It provides:

- separate `ui` and `learning` modes;
- native name and name in the current UI language;
- search that is case- and accent-insensitive;
- active and recent language ordering;
- a secondary decorative flag, never a flag-only label;
- accessible radio semantics.

The current `LocalePicker` delegates to this component while keeping its public
API. Regional identifiers prepared in Lot 0 remain compatible, but regional
registry entries are not introduced in this lot.

## Legacy migration and rollback

`apps/mobile/components/ui.tsx` remains available. Its exports are marked
deprecated and delegate to the converged components:

| Legacy export | Target |
| --- | --- |
| `Card` | `ds/core.Card` |
| `Button` | `ds/core.Button` |
| `ErrorBanner` | `ds/core.Alert` or `ds/states.SmartErrorState` |
| `Loading` | `ds/states.SmartLoadingState` |
| `Empty` | `ds/states.SmartEmptyState` |

Migration is intentionally screen-by-screen. No bulk import rewrite is allowed.
Rollback consists of retaining or restoring the legacy import for the affected
screen; no route or backend contract changes are involved.

## Accessibility and performance rules

- Interactive targets remain at least 44 pt.
- Text and icon labels accompany semantic colour.
- Source and language rows expose explicit accessibility roles.
- No indeterminate operation displays a fake percentage.
- Lists use `FlatList`; large language lists are not rendered eagerly.
- Layout derives from one window-dimension subscription.
- Reduced-motion behavior continues to come from the theme provider.

## Explicit exclusions

This lot does not implement the new AppShell, change route behavior, activate
UX feature flags, redesign Home/Learn/Brain/Tutor/Landing or install a new icon
or animation library. Those remain later, independently reversible lots.
