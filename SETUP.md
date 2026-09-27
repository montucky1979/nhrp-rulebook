# NHRP Rulebook CMS Setup

## Existing installation (recommended for this project)

You already have the Rulebook CMS connected to Supabase. For this Discord-admin upgrade:

1. Keep your current working `supabase-config.js`.
2. Run `supabase-discord-upgrade.sql` in Supabase SQL Editor.
3. Configure Discord OAuth in Supabase.
4. Deploy the `verify-discord-admin` Edge Function using `verify-discord-admin.ts`.
5. Upload the updated website files to GitHub.

See `DISCORD_ADMIN_SETUP.md` for the exact walkthrough.

## Fresh installation

1. Run `supabase-schema.sql`.
2. Run `supabase-seed.sql`.
3. Configure `supabase-config.js` with the project URL and publishable key.
4. Follow `DISCORD_ADMIN_SETUP.md` beginning with the Discord OAuth setup.

## Admin access

Admin login is Discord-only. The approved Discord IDs are built into the verification function:

- Server: 1535665131042639952
- Executive: 1535665132720488481
- Owner: 1535665132720488482

Owner and Executive have identical full permissions.

The old `supabase-make-admin.sql` file is not used by the Discord version.
