// POST /api/queue/[id]/reset-render
// Resets a stuck video_rendering item back to approved.
// Used when Creatomate webhook never fires (e.g. localhost dev without tunnel).

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('content_queue')
    .update({ status: 'approved' })
    .eq('id', id)
    .eq('user_id', user.id)
    .in('status', ['video_rendering'])   // only reset if actually stuck
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Item not found or not in rendering state' }, { status: 404 })

  return NextResponse.json({ success: true })
}
