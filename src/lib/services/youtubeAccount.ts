import { createClient } from '@/lib/supabase/server'
import { decryptSecret, encryptSecret } from '@/lib/security/tokens'
import { refreshYoutubeToken } from '@/lib/services/youtubeOAuth'

type AccessTokenResult =
  | { success: true; accessToken: string }
  | { success: false; error: string }

function shouldRefresh(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000
}

export async function getActiveYouTubeAccessToken(userId: string): Promise<AccessTokenResult> {
  const supabase = await createClient()

  const { data: account, error } = await supabase
    .from('connected_accounts')
    .select('id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('user_id', userId)
    .eq('platform', 'youtube')
    .eq('is_active', true)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  if (!account) {
    return { success: false, error: 'No active YouTube account connected.' }
  }

  try {
    let accessToken = decryptSecret(account.access_token_encrypted)

    if (shouldRefresh(account.token_expires_at)) {
      if (!account.refresh_token_encrypted) {
        return { success: false, error: 'YouTube token expired and no refresh token is available.' }
      }

      const refreshToken = decryptSecret(account.refresh_token_encrypted)
      const refreshed = await refreshYoutubeToken(refreshToken)
      accessToken = refreshed.access_token

      const updates: Record<string, unknown> = {
        access_token_encrypted: encryptSecret(refreshed.access_token),
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        last_refreshed_at: new Date().toISOString(),
      }

      if (refreshed.refresh_token) {
        updates.refresh_token_encrypted = encryptSecret(refreshed.refresh_token)
      }

      await supabase.from('connected_accounts').update(updates).eq('id', account.id)
    }

    return { success: true, accessToken }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to resolve YouTube access token.' }
  }
}
