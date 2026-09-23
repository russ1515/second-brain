# Prisma baseline of the existing database

## Why a baseline was needed

On 3 September 2026, the PostgreSQL schema already matched
`apps/api/prisma/schema.prisma`, and user data already existed, but the
`_prisma_migrations` history table was absent. Running `migrate reset`, replaying
the migrations, or using `db push` would have put those data at risk.

## Safe strategy used

The following read-only checks were performed first:

```bash
pnpm --filter @second-brain/api exec prisma migrate diff \
  --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

The result was `No difference detected`. Counts for users, documents, document
chunks, and subscriptions were recorded. Each of the 49 existing migration
directories was then registered, in chronological order, with:

```bash
pnpm --filter @second-brain/api exec prisma migrate resolve \
  --applied <migration-directory-name>
```

This command only creates migration history entries; it does not execute the
migration SQL. No reset, `db push`, table recreation, volume deletion, or data
rewrite was performed.

## Verification

After the baseline:

- `prisma migrate status` reported all 49 migrations applied and the schema up to date;
- a second schema diff reported no difference;
- the pre-baseline user/document/chunk/subscription counts were unchanged;
- `_prisma_migrations` contained 49 successful rows.

Normal startup and deployment must now use `prisma migrate deploy`. Never use
`migrate reset` against an environment containing data. Before deploying a new
migration, take a database backup and verify its restore procedure.
