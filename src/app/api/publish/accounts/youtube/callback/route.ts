import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptSecret, encryptSecret } from '@/lib/security/tokens'
import { exchangeYoutubeCode, getYoutubeChannel } from '@/lib/services/youtubeOAuth'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(new URL(`/publish?connect_error=${encodeURIComponent(oauthError)}`, request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/publish?connect_error=missing_code_or_state', request.url))
  }

  const supabase = await createClient()

  const { data: stateRow, error: stateError } = await supabase
    .from('oauth_states')
    .select('id, user_id, state, code_verifier_encrypted, expires_at, used_at')
    .eq('state', state)
    .eq('platform', 'youtube')
    .maybeSingle()

  if (stateError || !stateRow) {
    return NextResponse.redirect(new URL('/publish?connect_error=invalid_state', request.url))
  }

  if (stateRow.used_at) {
    return NextResponse.redirect(new URL('/publish?connect_error=state_already_used', request.url))
  }

  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(new URL('/publish?connect_error=state_expired', request.url))
  }

  try {
    const codeVerifier = decryptSecret(stateRow.code_verifier_encrypted)
    const token = await exchangeYoutubeCode(code, codeVerifier)
    const channel = await getYoutubeChannel(token.access_token)

    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString()

    const upsertPayload = {
      user_id: stateRow.user_id,
      platform: 'youtube',
      account_external_id: channel.channelId,
      account_name: channel.title,
      scopes: token.scope.split(' ').filter(Boolean),
      access_token_encrypted: encryptSecret(token.access_token),
      refresh_token_encrypted: token.refresh_token ? encryptSecret(token.refresh_token) : null,
      token_expires_at: expiresAt,
      is_active: true,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
    }

    const { error: accountError } = await supabase
      .from('connected_accounts')
      .upsert(upsertPayload, { onConflict: 'user_id,platform,account_external_id' })

    if (accountError) {
      throw new Error(accountError.message)
    }

    await supabase
      .from('oauth_states')
      .update({ used_at: new Date().toISOString() })
      .eq('id', stateRow.id)

    return NextResponse.redirect(new URL('/publish?connected=youtube', request.url))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth callback failed'
    return NextResponse.redirect(new URL(`/publish?connect_error=${encodeURIComponent(message)}`, request.url))
  }
}
