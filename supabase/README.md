# Supabase database

Current project: `glywgbhuqrfxgowovylo`

This repository now mirrors the migrations that are actually recorded in the
current Supabase project's migration history.

## Recorded migrations

| Version | Migration |
|---|---|
| 20260920190918 | `erp_foundation_numbering` |
| 20260920191039 | `core_erp_schema` |
| 20260920191131 | `security_finance_integrity` |
| 20260922233302 | `analytics_backup_automation_controls` |

The SQL files under `supabase/migrations/` were copied from
`supabase_migrations.schema_migrations` after each migration was applied.

## Important schema-drift note

The ERP was expanded rapidly after the original three recorded migrations.
Some earlier live DDL for Design, Construction, Procurement, HR, Documents,
Meetings, Portals and related workflow controls was applied directly to the
database before the migration-tracking cleanup.

That means:

- the four timestamped migration files above are authentic migration-history
  records;
- they do **not yet guarantee** that a brand-new Supabase project can reproduce
  the entire current ERP schema from zero;
- new DDL from this point forward should use Supabase migrations first and be
  mirrored into this folder;
- before production merge, create a consolidated current-schema baseline (or
  backfill the missing module migrations) and test it against a fresh database.

## Application backup

The ERP also has a Founder/Admin JSON application backup under
`/backup.html`.

It backs up application table rows and document storage paths, but it does not
replace platform disaster recovery. It intentionally excludes:

- Supabase Auth credentials and sessions
- actual Supabase Storage file bytes
- secrets and hosting configuration
- platform backup history

Restore is guarded: it requires an operationally empty target and compatible
Supabase Auth user IDs.

## Security

The browser uses the Supabase publishable key with RLS. Never commit a service
role key or database password to this repository.
