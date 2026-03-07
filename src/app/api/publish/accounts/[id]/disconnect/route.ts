import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'
import { decryptSecret, encryptSecret } from '@/lib/security/tokens'
import { revokeYoutubeToken } from '@/lib/services/youtubeOAuth'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const supabase = await createClient()

  const { data: account, error: lookupError } = await supabase
    .from('connected_accounts')
    .select('id, user_id, platform, access_token_encrypted')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }

  if (!account) {
    return NextResponse.json({ error: 'Connected account not found' }, { status: 404 })
  }

  try {
    const token = decryptSecret(account.access_token_encrypted)
    await revokeYoutubeToken(token)
  } catch {
    // best-effort revoke only
  }

  const { error: updateError } = await supabase
    .from('connected_accounts')
    .update({
      is_active: false,
      disconnected_at: new Date().toISOString(),
      access_token_encrypted: encryptSecret('revoked'),
      refresh_token_encrypted: null,
      token_expires_at: null,
    })
    .eq('id', account.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

