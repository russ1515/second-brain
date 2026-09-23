# App Shell — UX-2 Lot 2

The new shell is additive and disabled by default. It does not rename a route,
change a domain screen or replace Expo Router.

## Activation and rollback

- `EXPO_PUBLIC_FEATURE_NEW_APP_SHELL=true` enables the route-aware shell.
- `EXPO_PUBLIC_NEW_APP_SHELL_ROUTES` can contain comma-separated registered
  metadata paths such as `/,/learn,/library,/library/[id]`.
- An empty route list enables every registered route while the flag is true.
- An omitted route immediately uses the previous Stack/Tabs chrome. Unknown
  URLs also fail closed to the previous Stack.

The route list accepts metadata templates, not arbitrary URL patterns. Dynamic
URLs are resolved to their registered template before rollout is evaluated.

## User shell

The five spaces remain Accueil, Apprendre, Mon Cerveau, Réviser and Profil.
Desktop keeps the collapsible sidebar; tablet and mobile keep the bottom bar.
Secondary routes add a compact back action and breadcrumb without changing the
screen's own content. Focused/immersive routes keep the desktop sidebar, while
compact layouts keep only the back/breadcrumb chrome so the task has room.

The Stack stays mounted in a stable root boundary while chrome changes. This is
important when moving between a user route and an internal route: shell changes
must not reset navigation state.

## Authentication and deep links

When the shell is active for a protected route, the root layout owns the guard:

- loading shows a real loading state;
- an unreachable API preserves the stored session and offers retry/sign-out;
- a signed-out deep link moves to `/sign-in` with a validated return path;
- incomplete onboarding moves to `/onboarding`, then resumes the validated
  protected destination.

Return paths are accepted only when they resolve to a registered authenticated
route. Public, onboarding and unknown destinations fall back to `/`.

## Internal shell and authorization

`ADMIN`, `TECH` and `DEMO` routes use separate internal chrome with a clear way
back to the product. They never appear in the five-space navigation. Client
authentication prevents anonymous deep links; permissions remain enforced by
the existing backend guards because the public `AuthUser` contract contains no
authoritative platform or organization permission set.
