NHRP RULEBOOK CMS — DISCORD ADMIN EDITION

Public rulebook design retained.

New in this build:
- Discord OAuth admin sign-in
- NHRP Server verification
- Owner + Executive role verification
- Owner and Executive have identical full permissions
- Role access is rechecked while the admin page is open
- Recently Changed Rules public panel
- NEW / UPDATED badges and dates
- Configurable recent-highlight duration (default 14 days)
- Change notes displayed with recent updates
- Existing rules are not falsely marked as recently changed on upgrade

CURRENT DISCORD IDS
Server:    1535665131042639952
Executive: 1535665132720488481
Owner:     1535665132720488482

For an existing Supabase project, run:
supabase-discord-upgrade.sql

Then deploy the Edge Function using:
verify-discord-admin.ts

See DISCORD_ADMIN_SETUP.md for the complete one-time setup.
