import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('connected_accounts')
    .select('id, platform, account_external_id, account_name, scopes, is_active, connected_at, disconnected_at, token_expires_at')
    .eq('user_id', user.id)
    .order('connected_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ accounts: data ?? [] })
}
