import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api'
import { PacingStyle, VisualStyle } from '@/types/series'

type RouteContext = { params: Promise<{ id: string }> }

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required')
  }

  return createClient(url, key)
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value === 'string') {
    const n = Number(value.trim())
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return null
}

const VALID_PACING_STYLES: PacingStyle[] = ['fast', 'medium', 'slow']
const VALID_VISUAL_STYLES: VisualStyle[] = ['b-roll', 'talking-head', 'mixed']

// PATCH /api/series/[id]
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await context.params
  if (!id || id.trim() === '') {
    return NextResponse.json({ error: 'Series id is required' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const niche = typeof body.niche === 'string' ? body.niche.trim() : ''
  const tone = typeof body.tone === 'string' ? body.tone.trim() : ''

  if (!name || !niche || !tone) {
    return NextResponse.json(
      { error: 'name, niche, and tone are required' },
      { status: 400 }
    )
  }

  // Duration: accept either a range (min+max) or legacy length_seconds
  const minSeconds = parsePositiveInt(body.min_seconds)
  const maxSeconds = parsePositiveInt(body.max_seconds)
  const lengthSeconds = parsePositiveInt(body.length_seconds)

  // Must provide either a valid range OR a legacy length
  const hasRange = minSeconds !== null && maxSeconds !== null
  const hasLegacy = lengthSeconds !== null

  if (!hasRange && !hasLegacy) {
    return NextResponse.json(
      { error: 'Provide either min_seconds + max_seconds, or length_seconds' },
      { status: 400 }
    )
  }

  if (hasRange && maxSeconds! <= minSeconds!) {
    return NextResponse.json(
      { error: 'max_seconds must be greater than min_seconds' },
      { status: 400 }
    )
  }

  // Optional creative controls
  const pacingStyle = VALID_PACING_STYLES.includes(body.pacing_style as PacingStyle)
    ? (body.pacing_style as PacingStyle)
    : null

  const visualStyle = VALID_VISUAL_STYLES.includes(body.visual_style as VisualStyle)
    ? (body.visual_style as VisualStyle)
    : null

  const supabase = getAdminClient()

  const updatePayload: Record<string, unknown> = {
    name,
    niche,
    tone,
    pacing_style: pacingStyle,
    visual_style: visualStyle,
  }

  if (hasRange) {
    updatePayload.min_seconds = minSeconds
    updatePayload.max_seconds = maxSeconds
    // Derive a representative length_seconds midpoint for backward compat
    updatePayload.length_seconds = Math.round((minSeconds! + maxSeconds!) / 2)
  } else {
    updatePayload.length_seconds = lengthSeconds
    updatePayload.min_seconds = Math.round(lengthSeconds! * 0.8)
    updatePayload.max_seconds = Math.round(lengthSeconds! * 1.2)
  }

  const { data: updated, error: updateError } = await supabase
    .from('series')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, user_id, name, niche, tone, length_seconds, min_seconds, max_seconds, pacing_style, visual_style, created_at')
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (!updated) {
    return NextResponse.json({ error: 'Series not found or not permitted' }, { status: 404 })
  }

  return NextResponse.json({ success: true, series: updated })
}

// DELETE /api/series/[id]
// Safety guard: block delete if queue items already exist for this series.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await context.params
  if (!id || id.trim() === '') {
    return NextResponse.json({ error: 'Series id is required' }, { status: 400 })
  }

  const supabase = getAdminClient()

  const { data: seriesRow, error: lookupError } = await supabase
    .from('series')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }

  if (!seriesRow) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  }

  const { count, error: queueCountError } = await supabase
    .from('content_queue')
    .select('id', { count: 'exact', head: true })
    .eq('series_id', id)
    .eq('user_id', user.id)

  if (queueCountError) {
    return NextResponse.json({ error: queueCountError.message }, { status: 500 })
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: 'Cannot delete a series that already has generated queue items. Delete/archive those items first.',
      },
      { status: 409 }
    )
  }

  const { data: deleted, error: deleteError } = await supabase
    .from('series')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  if (!deleted) {
    return NextResponse.json({ error: 'Series not found or not permitted' }, { status: 404 })
  }

  return NextResponse.json({ success: true, deletedId: deleted.id })
}
