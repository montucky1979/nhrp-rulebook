import { withSupabase } from 'npm:@supabase/server@^1'

const NHRP_GUILD_ID = '1535665131042639952'
const EXECUTIVE_ROLE_ID = '1535665132720488481'
const OWNER_ROLE_ID = '1535665132720488482'
const VERIFY_FOR_MINUTES = 120

function json(data: Record<string, unknown>, status = 200) {
  return Response.json(data, { status })
}

function findDiscordIdentityId(user: any): string | null {
  const direct = user?.user_metadata?.provider_id || user?.user_metadata?.sub
  if (direct) return String(direct)
  const identity = (user?.identities || []).find((i: any) => i?.provider === 'discord')
  const data = identity?.identity_data || {}
  return data.provider_id ? String(data.provider_id) : data.sub ? String(data.sub) : data.id ? String(data.id) : null
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const body = await req.json().catch(() => ({})) as { provider_token?: string }
      const providerToken = body?.provider_token?.trim()
      if (!providerToken) return json({ authorized: false, reason: 'missing_provider_token' }, 400)

      const userId = String(ctx.userClaims?.id || ctx.jwtClaims?.sub || '')
      if (!userId) return json({ authorized: false, reason: 'missing_user' }, 401)

      const { data: userResult, error: userError } = await ctx.supabaseAdmin.auth.admin.getUserById(userId)
      const user = userResult?.user
      if (userError || !user) return json({ authorized: false, reason: 'user_lookup_failed' }, 401)

      const providers: string[] = user?.app_metadata?.providers || []
      const primaryProvider = user?.app_metadata?.provider
      if (primaryProvider !== 'discord' && !providers.includes('discord')) {
        return json({ authorized: false, reason: 'discord_login_required' }, 403)
      }

      const meResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${providerToken}` },
      })
      if (!meResponse.ok) {
        return json({ authorized: false, reason: 'discord_token_invalid' }, 401)
      }
      const discordUser = await meResponse.json()
      const expectedDiscordId = findDiscordIdentityId(user)
      if (expectedDiscordId && String(discordUser.id) !== expectedDiscordId) {
        return json({ authorized: false, reason: 'discord_identity_mismatch' }, 403)
      }

      const memberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${NHRP_GUILD_ID}/member`, {
        headers: { Authorization: `Bearer ${providerToken}` },
      })

      if (memberResponse.status === 401 || memberResponse.status === 403 || memberResponse.status === 404) {
        await ctx.supabaseAdmin.from('rulebook_admins').update({
          active: false,
          verified_until: new Date().toISOString(),
        }).eq('user_id', userId)
        return json({ authorized: false, reason: 'not_in_nhrp_or_scope_missing' }, 403)
      }
      if (!memberResponse.ok) {
        return json({ authorized: false, reason: 'discord_member_lookup_failed' }, 502)
      }

      const member = await memberResponse.json()
      const roles = new Set<string>((member?.roles || []).map((r: unknown) => String(r)))
      const isOwner = roles.has(OWNER_ROLE_ID)
      const isExecutive = roles.has(EXECUTIVE_ROLE_ID)
      if (!isOwner && !isExecutive) {
        await ctx.supabaseAdmin.from('rulebook_admins').upsert({
          user_id: userId,
          email: user.email || null,
          role: 'admin',
          active: false,
          discord_user_id: String(discordUser.id),
          discord_username: discordUser.global_name || discordUser.username || 'Discord User',
          verified_at: new Date().toISOString(),
          verified_until: new Date().toISOString(),
          verification_source: 'discord',
        }, { onConflict: 'user_id' })
        return json({ authorized: false, reason: 'required_role_missing' }, 403)
      }

      const now = new Date()
      const verifiedUntil = new Date(now.getTime() + VERIFY_FOR_MINUTES * 60_000)
      const displayName = member?.nick || discordUser.global_name || discordUser.username || 'Discord User'
      const matchedRole = isOwner ? 'Owner' : 'Executive'

      const { error: upsertError } = await ctx.supabaseAdmin.from('rulebook_admins').upsert({
        user_id: userId,
        email: user.email || null,
        role: 'admin',
        active: true,
        discord_user_id: String(discordUser.id),
        discord_username: displayName,
        discord_role_label: matchedRole,
        verified_at: now.toISOString(),
        verified_until: verifiedUntil.toISOString(),
        verification_source: 'discord',
      }, { onConflict: 'user_id' })

      if (upsertError) return json({ authorized: false, reason: 'admin_sync_failed', detail: upsertError.message }, 500)

      return json({
        authorized: true,
        display_name: displayName,
        discord_user_id: String(discordUser.id),
        role: matchedRole,
        permissions: 'full',
        verified_until: verifiedUntil.toISOString(),
      })
    } catch (error) {
      return json({ authorized: false, reason: 'unexpected_error', detail: error instanceof Error ? error.message : String(error) }, 500)
    }
  }),
}
