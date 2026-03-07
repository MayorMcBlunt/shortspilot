import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { uploadFromUrl } from '@/lib/services/storage'
import type { CreatomateWebhookPayload } from '@/lib/services/creatomate'

// POST /api/webhooks?provider=creatomate
// Receives render completion events from Creatomate.
// Updates video_jobs row, then content_queue row.

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for webhook writes')
  }

  return createClient(url, key)
}

function verifyCreatomateWebhook(request: NextRequest): boolean {
  const expectedSecret = process.env.CREATOMATE_WEBHOOK_SECRET?.trim()
  if (!expectedSecret) return true

  const url = new URL(request.url)
  const token = url.searchParams.get('token')?.trim()
  const headerSecret = request.headers.get('x-webhook-secret')?.trim()

  return token === expectedSecret || headerSecret === expectedSecret
}

export async function POST(request: NextRequest) {
  const provider = new URL(request.url).searchParams.get('provider')

  if (provider !== 'creatomate') {
    console.warn(`[webhooks] Unknown provider: "${provider}"`)
    return NextResponse.json({ received: true })
  }

  try {
    return await handleCreatomateWebhook(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    console.error('[webhooks/creatomate] fatal:', message)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleCreatomateWebhook(request: NextRequest): Promise<NextResponse> {
  if (!verifyCreatomateWebhook(request)) {
    return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 })
  }

  let payload: CreatomateWebhookPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { id: externalJobId, status, url: videoUrl, error_message } = payload

  if (!externalJobId) {
    return NextResponse.json({ error: 'Missing job id in payload' }, { status: 400 })
  }

  if (status !== 'succeeded' && status !== 'failed') {
    console.warn(`[webhooks/creatomate] Ignoring unsupported status "${String(status)}" for ${externalJobId}`)
    return NextResponse.json({ received: true })
  }

  const supabase = getAdminClient()

  const { data: videoJob, error: lookupError } = await supabase
    .from('video_jobs')
    .select('id, queue_item_id, user_id, provider')
    .eq('external_job_id', externalJobId)
    .single()

  if (lookupError || !videoJob) {
    console.error(`[webhooks/creatomate] No video_jobs row found for external_job_id: ${externalJobId}`)
    // Return 200 so provider retries do not keep hammering unknown jobs.
    return NextResponse.json({ received: true })
  }

  if (status === 'succeeded') {
    if (!videoUrl) {
      console.error(`[webhooks/creatomate] Success callback missing video URL for ${videoJob.queue_item_id}`)
      return NextResponse.json({ received: true })
    }

    const storagePath = `video/${videoJob.queue_item_id}.mp4`
    const uploadResult = await uploadFromUrl(videoUrl, storagePath, 'video/mp4')
    const finalVideoUrl = uploadResult.success ? uploadResult.url : videoUrl

    const { data: completedJob, error: jobUpdateError } = await supabase
      .from('video_jobs')
      .update({
        status: 'completed',
        video_url: finalVideoUrl,
        completed_at: new Date().toISOString(),
      })
      .eq('id', videoJob.id)
      .in('status', ['queued', 'processing', 'failed'])
      .select('id')
      .maybeSingle()

    if (jobUpdateError) {
      throw new Error(`Failed to update video_jobs to completed: ${jobUpdateError.message}`)
    }

    const { data: queueRow, error: queueUpdateError } = await supabase
      .from('content_queue')
      .update({
        status: 'video_ready',
        video_url: finalVideoUrl,
      })
      .eq('id', videoJob.queue_item_id)
      .eq('status', 'video_rendering')
      .select('id')
      .maybeSingle()

    if (queueUpdateError) {
      throw new Error(`Failed to update content_queue to video_ready: ${queueUpdateError.message}`)
    }

    if (!completedJob) {
      console.log(`[webhooks/creatomate] Duplicate success callback ignored for ${videoJob.queue_item_id}`)
    } else if (!queueRow) {
      console.log(`[webhooks/creatomate] Queue already moved out of rendering for ${videoJob.queue_item_id}`)
    } else {
      console.log(`[webhooks/creatomate] Render complete for queue item ${videoJob.queue_item_id}`)
    }

    return NextResponse.json({ received: true })
  }

  const errMsg = error_message ?? 'Unknown render error'

  const { data: failedJob, error: failedUpdateError } = await supabase
    .from('video_jobs')
    .update({
      status: 'failed',
      error_message: errMsg,
      completed_at: new Date().toISOString(),
    })
    .eq('id', videoJob.id)
    .in('status', ['queued', 'processing'])
    .select('id')
    .maybeSingle()

  if (failedUpdateError) {
    throw new Error(`Failed to update video_jobs to failed: ${failedUpdateError.message}`)
  }

  const { error: rollbackError } = await supabase
    .from('content_queue')
    .update({ status: 'approved' })
    .eq('id', videoJob.queue_item_id)
    .eq('status', 'video_rendering')

  if (rollbackError) {
    throw new Error(`Failed to roll back content_queue after render failure: ${rollbackError.message}`)
  }

  if (!failedJob) {
    console.log(`[webhooks/creatomate] Late failed callback ignored for ${videoJob.queue_item_id}`)
  } else {
    console.error(`[webhooks/creatomate] Render failed for queue item ${videoJob.queue_item_id}: ${errMsg}`)
  }

  return NextResponse.json({ received: true })
}
