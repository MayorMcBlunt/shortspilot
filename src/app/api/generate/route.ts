import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'
import { runContentPipeline } from '@/lib/jobs/generateContent'
import { isValidPlatform } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  let body: { seriesId?: unknown; platform?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { seriesId, platform } = body

  if (!seriesId || typeof seriesId !== 'string' || seriesId.trim() === '') {
    return NextResponse.json({ error: 'seriesId is required' }, { status: 400 })
  }

  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: 'platform must be one of: tiktok, instagram, youtube' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('*')
    .eq('id', seriesId.trim())
    .eq('user_id', user.id)
    .single()

  if (seriesError || !series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  }

  const result = await runContentPipeline(series, platform, user.id)

  if (!result.success) {
    return NextResponse.json({ error: result.error, failedAgent: result.failedAgent }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    queueItemId: result.queueItemId,
    jobId: result.jobId,
    message: 'Content generated and added to review queue',
  })
}
