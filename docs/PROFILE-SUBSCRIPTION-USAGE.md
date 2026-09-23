# Profile, subscription and usage

Lot 3 reorganizes account controls without changing the existing routes or the
billing model. The implementation deliberately keeps commercial values in the
backend: the mobile application renders `/plans`, `/subscription`, `/usage` and
`/billing/invoices` rather than embedding plan limits or prices.

## Profile information architecture

`/(tabs)/profile` is the account control centre and is organized into five
sections:

1. **My profile** — photo, identity and onboarding/KYC summary.
2. **Second Brain personalization** — AI Professor posture and explanation
   density, plus a small learning-profile preview linking to My Brain.
3. **Languages & experience** — interface locale, native language and learning
   language, with a link to the specialized Languages & Immersion experience.
4. **Subscription & usage** — current plan and the most relevant real usage
   meters, with direct links to `/subscription` and `/usage`.
5. **Data & privacy** — theme, AI memory, library and privacy controls.

Detailed Learning DNA, memory health and mastery are not duplicated in Profile;
they remain owned by My Brain.

## Usage contract

Each `UsageItem` exposes `used`, `limit`, `unit` and `resetAt`:

- counters such as AI questions and voice minutes expose the next real reset
  time when the backend knows it;
- live gauges such as document count and storage have no reset time;
- a missing or negative configured limit is returned as `null` and displayed as
  unlimited;
- labels and units are user-facing and localized; raw token counts are not
  presented.

The usage service resolves entitlements once per snapshot, then reads all metric
values. This is an additive response-contract change and requires no database
migration.

When a limit is reached, `/usage` explains whether it resets or reflects current
capacity, links to subscription management, and explicitly preserves access to
features that do not consume that quota. Enforcement continues to come from the
existing backend quota service.

## Subscription behavior

`/subscription` shows the current offer, state, period or trial end, the most
relevant usage meters, individual plan limits, contextual upgrade actions and
invoices. Organization offers stay available through their existing dedicated
flows and are not mixed into the individual comparison grid.

A paid plan without backend pricing is shown as unavailable and cannot start a
checkout. The fake checkout confirmation remains development-only behavior from
the existing billing provider; production providers continue to open their
hosted checkout URL.

## Failure and rollback boundaries

Profile and billing reads use partial-result handling: one unavailable endpoint
does not hide unrelated settings or alter an existing subscription. Mutation
errors remain visible and retryable. Lot 3 can be rolled back by reverting its
screen/component and additive usage-contract changes; no data rollback or
migration is needed.
