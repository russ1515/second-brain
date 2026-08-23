# Second Brain — Design System (UI/UX Sprint 1)

The official visual language. Every screen is built from this — no ad-hoc colours,
sizes, radii, shadows or durations. Identity: **premium · intelligent · human ·
calm**. Not an LMS, chatbot, bank dashboard or Notion clone.

Open the living reference at **`/design-system`** (the Design Playground) and
toggle Light / Dark / System.

## Where things live

| Layer | File |
| --- | --- |
| Tokens | `apps/mobile/lib/design/tokens.ts` |
| Theme provider + hooks | `apps/mobile/lib/design/theme.tsx` |
| Core components | `apps/mobile/components/ds/core.tsx` |
| AI Design Language | `apps/mobile/components/ds/ai.tsx` |
| Learning components | `apps/mobile/components/ds/learning.tsx` |
| Language components | `apps/mobile/components/ds/language.tsx` |
| Playground | `apps/mobile/app/design-system.tsx` |

## Tokens

Components read tokens via `useTokens()` / `useTheme()` — **never** hard-coded
values. Colours are **roles** (e.g. `primary`, `textSecondary`, `aiAccent`) mapped
to values per scheme, so light/dark and future theming are free.

- **Colours** — `primary` (calm indigo), `aiAccent` (violet, reserved for the AI
  Professor, often as the `aiGradient`), semantics (`success/warning/error/info`
  + `*Soft` backgrounds), warm-neutral `background/surface/surfaceElevated/
  surfaceSunken`, `textPrimary/textSecondary/textMuted`, `border*`, `focus`,
  `overlay`. Text roles meet **WCAG AA** on their intended backgrounds.
- **Typography** — 10 levels (`display → label`), style-only in `typography`,
  descriptions in `typographyUsage`. Hierarchy is legible without colour or icons.
- **Spacing** — one 4-based named scale (`xxs 4 … giant 80`). Nothing off-scale.
- **Radius / borderWidth / elevation** — `radius` (xs→full), `borderWidth`
  (subtle/default/strong/focus), `elevation` (none/low/medium/high, RN + web).
  Elevation is used sparingly — no floating-card soup.
- **Motion** — `motion.duration` (fast/normal/slow) + easings + `purpose`. An
  animation must explain or give feedback; never decorative. Honour reduced motion.
- **Breakpoints** — `mobile 0 / tablet 600 / desktop 1024 / large 1440`.

## Components & states

Core primitives (`core.tsx`): Button (primary/secondary/ghost/danger/**ai**,
sizes sm/md/lg, states default/pressed/disabled/loading/focus), IconButton, Badge
(7 tones), Card, SegmentedControl, Switch, Progress, Skeleton, Alert, Input
(label/focus/error), EmptyState. More primitives (Modal/Sheet/Drawer/Toast/
Tooltip/Tabs/Select/Checkbox/Radio/Avatar) are planned in the same pattern.

## AI Design Language ⭐

`ai.tsx` — the AI Professor as a present voice, not a tiny icon:
`AIRecommendation`, `AIInsight`, `AIExplanation`, `AIWarning`, `AIProgress`,
`AIAction`, `AITeacherMessage`. The **three postures** (`supportive` 🟢 /
`challenging` 🟡 / `examiner` 🔴) are a visual language conveyed by **icon +
label + colour together** (`PostureBadge`, `usePostureStyle`) — readable without
colour perception.

## Learning & Language components

- `learning.tsx` — MasteryIndicator, DifficultyIndicator, RevisionIndicator,
  ConceptCard, LessonStep, Flashcard, ExerciseCard, AnswerFeedback,
  KnowledgeRelation. Reused across Apprendre / Mon Cerveau / Réviser.
- `language.tsx` — LanguageBadge, NativeLanguage, StudyLanguage, BilingualText,
  TranslationHint, PronunciationIndicator (IPA + accuracy), VoiceState
  (speaking/listening/recording). Built to hold 25+ languages without breaking
  layout; the shared registry (`@second-brain/shared` → `languages.ts`) is the
  source of names/flags.

## Responsive

`useResponsive()` (`apps/mobile/lib/responsive.ts`) drives columns and content
width from live dimensions. Layout **transforms** per context (desktop: sidebar +
content + AI context; mobile: content + bottom nav) — it is not "just smaller".
The 5 spaces (Accueil / Apprendre / Mon Cerveau / Réviser / Profil) stay identical
conceptually across platforms.

## Accessibility (built in, not bolted on)

- Colour contrast targets documented in `tokens.a11y` (AA).
- Visible **focus rings** on Button/Input/IconButton (keyboard).
- `accessibilityRole` / `accessibilityLabel` / `accessibilityState` on controls.
- **44pt** minimum touch targets.
- Status conveyed by **icon + text**, never colour alone.
- OS **reduce-motion** honoured (Skeleton and future animations).

## Usage

```tsx
import { useTokens } from '../lib/design/theme';
import { Button, Card } from '../components/ds/core';
import { AIRecommendation } from '../components/ds/ai';

function Example() {
  const { colors, spacing } = useTokens();
  return (
    <Card>
      <AIRecommendation title="…" body="…" />
      <Button label="Commencer" variant="ai" onPress={start} />
    </Card>
  );
}
```

## Not in Sprint 1

No business screen is redesigned here (Home/Learn/Brain/Study/Profile keep their
current implementation on the legacy `lib/theme.ts`). Sprint 1 builds the
language; later UX sprints migrate the screens onto it.
