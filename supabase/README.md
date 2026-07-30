# Database

Project: `eyfccifvzhdgjrhnxsrm` · region `ap-south-1` (Mumbai)

Applied migrations, in order:

| # | Migration | Purpose |
|---|-----------|---------|
| 000 | proposal_generator_base | Original 4 tables + 5 public proposal RPCs |
| 001 | identity_and_access_foundation | profiles, user_roles, role helpers, signup trigger |
| 002 | crm_and_sales | clients, notes, files, meetings, proposal_items, targets, stage config |
| 003 | harden_access_and_first_user_bootstrap | Role-gated RLS, first-user owner grant, stage sync |
| 004 | restore_data_from_tokyo | Data carried over from the Tokyo project |

The `.sql` files here are placeholders — the migrations are already applied and
recorded in Supabase's own migration history. Pull them locally with:

```bash
npx supabase link --project-ref eyfccifvzhdgjrhnxsrm
npx supabase db pull
```

## Notes

- Roles live in `user_roles`, never as a column on `profiles`. That is what
  stops a user editing their own permissions.
- `has_role` / `is_staff` / `is_admin` are SECURITY DEFINER. Without that,
  any policy querying `user_roles` recurses infinitely.
- **The first account to sign up automatically becomes `owner`.** Sign up
  before inviting anyone else.
- `leads.stage` (legacy smallint, used by the proposal generator) and
  `leads.stage_key` (enum, used by the ERP) are kept in sync by the
  `leads_sync_stage` trigger, so the two apps cannot drift apart.
- `clients` carries GSTIN, PAN and state_code from day one. Place of supply
  decides CGST+SGST vs IGST.
