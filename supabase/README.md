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
- a consolidated live-schema baseline now exists at `supabase/baseline/current_schema.sql`;
- the baseline inventory was audited on 23 Sep 2026 against the live project and
  contains all 78 public tables, 114 public/private functions, 52 user triggers,
  247 unique public/storage policies, and the `erp-documents` bucket;
- this inventory audit verifies object coverage, but a destructive fresh-project
  execution test is still required before calling the baseline fully bootstrapped
  from zero.

## Application backup

The ERP also has a Founder/Admin JSON application backup under
`/backup.html`.

It backs up application table rows. The same screen also provides a browser-side
ZIP export/restore for the private `erp-documents` Storage bucket.

The application JSON still does not replace platform disaster recovery. It
intentionally excludes:

- Supabase Auth credentials and sessions
- secrets and hosting configuration
- platform backup history

The Storage ZIP is a separate file and should be retained beside the matching
application JSON backup. New Storage archives use format v2 with per-object CRC32
checksums; restore is non-destructive and can safely resume when existing bucket
objects are a checksum-matched subset of the same archive.

Restore is guarded: it requires an operationally empty target and compatible
Supabase Auth user IDs.

## Security

The browser uses the Supabase publishable key with RLS. Never commit a service
role key or database password to this repository.
