# NHRP Rulebook CMS Setup

This build keeps the existing public NHRP rulebook design intact and adds a private Supabase-backed admin editor at `/admin.html`.

## What changes after setup

- Public page stays at `index.html` and keeps the existing look/animations.
- Rules are loaded from Supabase when it is available.
- The existing `rules-data.js` / `rules.json` remain as an emergency fallback so the rulebook still loads if Supabase is unavailable.
- Rule changes no longer require GitHub or Cloudflare redeploys.
- Admins edit rules at `/admin.html`, save drafts, preview, publish, archive, reorder, duplicate, and roll back old versions.
- Discord URL and revision date can be changed from the admin page.

## Step 1 — Create the database

In your Supabase project:

1. Open **SQL Editor**.
2. Create a new query.
3. Paste the entire contents of `supabase-schema.sql`.
4. Run it.
5. Create another query.
6. Paste the entire contents of `supabase-seed.sql`.
7. Run it.

The seed imports the current NHRP rulebook, including the September 26, 2026 updates.

## Step 2 — Create your admin login

1. In Supabase, go to **Authentication → Users**.
2. Click **Add user**.
3. Create the email/password you want to use for the rulebook admin.
4. Open `supabase-make-admin.sql`.
5. Replace `YOUR_ADMIN_EMAIL@example.com` with that email.
6. Run it in SQL Editor.

You can add additional admin/editor users later by inserting them into `public.rulebook_admins`.

## Step 3 — Connect the website to Supabase

In Supabase go to **Project Settings → API** (or the current API Keys page) and copy:

- Project URL
- `anon` public key / publishable key

Open `supabase-config.js` and replace:

```js
SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
```

with your real values.

**Do not put the `service_role` secret key in the website.** The public/publishable key is the correct browser key; Row Level Security protects the admin operations.

You may leave `FALLBACK_DISCORD_URL` as a backup. After setup, change the live Discord URL from the admin page instead.

## Step 4 — Upload this build to GitHub once

Replace the current files in your `nhrp-rulebook` GitHub repo with the files in this package and commit to `main`.

Cloudflare will deploy the update automatically.

After that, normal rule changes no longer require GitHub.

## Step 5 — Use the admin page

Go to:

`https://YOUR-RULEBOOK-ADDRESS/admin.html`

Sign in with the Supabase admin account you created.

### Rule editor features

- Add a rule
- Edit title/category
- Add/remove/reorder rule lines
- Main bullet / sub-bullet levels
- Save Draft without changing the public version
- Preview before publish
- Publish instantly
- Reorder rule sections
- Feature/unfeature rules in **Key Rules**
- Duplicate a rule
- Archive/unarchive
- Change history
- Roll back to an older published version

### Site Settings

Click **Site Settings** to change:

- Discord invite URL
- Revision date

The revision date is also updated automatically when you publish a rule.

## How drafts work

For an already-published rule, **Save Draft** stores your edits privately in Supabase and leaves the live rule unchanged.

When you click **Save & Publish**, the draft becomes the public rule immediately and the previous public version is saved in history for rollback.

## Emergency fallback

If Supabase cannot be reached, the public page falls back to `rules-data.js` / `rules.json`. This is intentional so a database outage does not blank the rulebook.

If you ever need to permanently refresh the fallback copy, export the current rules and replace those files during a normal GitHub update.
