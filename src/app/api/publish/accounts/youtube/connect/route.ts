import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'
import { createPkcePair, buildYoutubeAuthUrl } from '@/lib/services/youtubeOAuth'
import { encryptSecret } from '@/lib/security/tokens'

export async function GET() {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const supabase = await createClient()
    const state = randomUUID()
    const { codeVerifier, codeChallenge } = createPkcePair()

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI ?? `${appUrl}/api/publish/accounts/youtube/callback`

    const { error } = await supabase.from('oauth_states').insert({
      user_id: user.id,
      platform: 'youtube',
      state,
      code_verifier_encrypted: encryptSecret(codeVerifier),
      redirect_uri: redirectUri,
      expires_at: expiresAt,
    })

    if (error) {
      return NextResponse.redirect(`${appUrl}/publish?connect_error=${encodeURIComponent(error.message)}`)
    }

    const authUrl = buildYoutubeAuthUrl(state, codeChallenge)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connect setup failed'
    return NextResponse.redirect(`${appUrl}/publish?connect_error=${encodeURIComponent(message)}`)
  }
}
