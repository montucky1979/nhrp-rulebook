# NHRP Rulebook — Discord Admin Upgrade

This upgrade keeps the existing public Rulebook look and changes admin access to Discord role verification.

## Access rules already built in

- NHRP Server/Guild ID: `1535665131042639952`
- Executive role ID: `1535665132720488481`
- Owner role ID: `1535665132720488482`
- Owner and Executive have the SAME full Rulebook CMS permissions.
- No other Discord role can enter the admin panel.
- Access is rechecked while the admin panel is open.

## Recently Changed Rules

Every time an authorized admin publishes a rule:

- The rule gets a NEW or UPDATED badge.
- It appears in a Recently Changed Rules panel near the top of the public rulebook.
- The change date is shown on the rule.
- The optional Change Note is shown in the recent update card.
- The highlight duration defaults to 14 days and can be changed from Admin > Site Settings.
- Existing imported rules are NOT all marked as recently changed when this upgrade is installed.

---

# One-time setup

## 1. Upgrade the existing Supabase database

In the Rulebook Supabase project:

1. Open SQL Editor.
2. Create a new query.
3. Open `supabase-discord-upgrade.sql` from this package.
4. Copy the entire file into the SQL Editor.
5. Click Run.

This changes Rulebook access from the old manually-added admin account system to Discord verification and adds the Recently Changed fields.

## 2. Create a Discord OAuth application

1. Open the Discord Developer Portal.
2. Create a new application such as `NHRP Rulebook Admin`.
3. Open OAuth2.
4. Keep the page open so you can copy the Client ID and Client Secret.

You do NOT need a Discord bot for this build. It uses Discord's `guilds.members.read` OAuth scope to verify the signed-in user's own NHRP server roles.

## 3. Enable Discord sign-in in Supabase

In Supabase:

1. Open Authentication > Sign In / Providers.
2. Open Discord.
3. Copy the Supabase Callback URL shown there. It will look like:
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
4. Go back to Discord Developer Portal > OAuth2 and add that URL as a Redirect.
5. In Supabase's Discord provider settings, enable Discord and enter the Discord Client ID and Client Secret.
6. Save.

## 4. Add the Rulebook redirect URLs in Supabase

Open Authentication > URL Configuration.

Set/add these URLs:

- Site URL: `https://nhrp-rulebook.nhrp.workers.dev/`
- Redirect URL: `https://nhrp-rulebook.nhrp.workers.dev/admin.html`
- Local testing redirect: `http://localhost:5500/admin.html`

## 5. Deploy the Discord verification Edge Function

In Supabase:

1. Open Edge Functions.
2. Click Deploy a new function.
3. Choose Via Editor.
4. Name the function exactly: `verify-discord-admin`
5. Replace the template code with the entire contents of `verify-discord-admin.ts`.
6. Deploy the function.
7. Leave JWT/user authentication enabled for the function.

No custom Edge Function secrets are needed for this version.

## 6. Upload the website upgrade to GitHub

Replace these website files in the `nhrp-rulebook` repository:

- `index.html`
- `styles.css`
- `script.js`
- `admin.html`
- `admin.css`
- `admin.js`

Do NOT replace your already-working `supabase-config.js` unless you intentionally want to re-enter your Supabase URL and publishable key.

Cloudflare should redeploy automatically after the GitHub commit.

## 7. Test

Open:

`https://nhrp-rulebook.nhrp.workers.dev/admin.html`

Click Continue with Discord.

- Owner role -> full access
- Executive role -> full access
- Any other role -> access denied

Publish one harmless test edit, then open the public rulebook. The changed rule should appear under Recently Changed Rules with an UPDATED badge.
