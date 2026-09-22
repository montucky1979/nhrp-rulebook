NHRP RULEBOOK SITE
=================

Files:
- index.html
- styles.css
- script.js
- rules.json
- rules-data.js (allows the site to work even when index.html is opened directly)

DEPLOY TO CLOUDFLARE PAGES
1. Put these four files in the root of a GitHub repository.
2. In Cloudflare Pages, connect the repository.
3. Framework preset: None.
4. Build command: leave blank.
5. Output directory: / (or leave blank if Cloudflare accepts repository root).

IMPORTANT: DISCORD LINK
Open script.js and replace:
const DISCORD_URL = "https://discord.gg/REPLACE_ME";
with your actual Discord invite.

ANIMATIONS INCLUDED
- Retro cop/criminal chase on the right side
- Running sprite legs and multi-level chase path
- Siren flashes, coins, countdown timer and score
- Heavy-set flannel/cowboy-hat character peeking from multiple spots
- Moving helicopter and spotlight
- Animated traffic
- Neon flicker and HUD effects

FUNCTIONAL FEATURES
- Full-text rule search
- Category filters
- A-Z/source-order sorting
- Expand/collapse rule cards
- Direct links to individual rules
- Copy rule-link button
- Punishment/Comms tables from the source document
- Responsive mobile layout
- Reduced-motion accessibility support

RULE CONTENT
The displayed rule text was generated from the provided NHRP Rules & Regulations DOCX (Revised August 24, 2026).
