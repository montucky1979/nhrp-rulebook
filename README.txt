NHRP RULEBOOK + ADMIN CMS

Public site:
  index.html

Private rule manager:
  admin.html

One-time setup files:
  SETUP.md
  supabase-schema.sql
  supabase-seed.sql
  supabase-make-admin.sql
  supabase-config.js

After Supabase setup, rule edits are made from admin.html and publish immediately.
The existing rules.json / rules-data.js remain as an emergency public-site fallback.

IMPORTANT:
Only place the Supabase public/publishable (anon) key in supabase-config.js.
Never place a Supabase service_role secret key in this website.
