// GET /api/queue/[id]/status
// Lightweight endpoint - returns only the current status and video_url.
// Used by ReviewEditor's auto-poll to detect video_rendering -> video_ready transition
// without triggering a full server-side page reload on every tick.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await params

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_queue')
    .select('status, video_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  return NextResponse.json(
    { status: data.status, video_url: data.video_url },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
