// POST /api/webhooks?provider=creatomate
// Receives render completion events from Creatomate.
// Updates video_jobs row → copies video_url to content_queue → sets status to video_ready.
//
// In stub mode, the renderVideo.ts orchestrator bypasses this and marks complete directly.
// This handler only runs for real Creatomate renders.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { uploadFromUrl } from '@/lib/services/storage'
import type { CreatomateWebhookPayload } from '@/lib/services/creatomate'

// Use service role key for webhook handler — no user session available
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  const provider = new URL(request.url).searchParams.get('provider')

  if (provider === 'creatomate') {
    return handleCreatomateWebhook(request)
  }

  // Unknown provider — acknowledge without processing
  console.warn(`[webhooks] Unknown provider: "${provider}"`)
  return NextResponse.json({ received: true })
}

async function handleCreatomateWebhook(request: NextRequest): Promise<NextResponse> {
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

  const supabase = getAdminClient()

  // Find the video_jobs row by external_job_id
  const { data: videoJob, error: lookupError } = await supabase
    .from('video_jobs')
    .select('id, queue_item_id, user_id, provider')
    .eq('external_job_id', externalJobId)
    .single()

  if (lookupError || !videoJob) {
    console.error(`[webhooks/creatomate] No video_jobs row found for external_job_id: ${externalJobId}`)
    // Return 200 so Creatomate doesn't keep retrying for unknown jobs
    return NextResponse.json({ received: true })
  }

  if (status === 'succeeded' && videoUrl) {
    // Re-upload to our own Supabase Storage so we own the file long-term
    const storagePath = `video/${videoJob.queue_item_id}.mp4`
    const uploadResult = await uploadFromUrl(videoUrl, storagePath, 'video/mp4')

    const finalVideoUrl = uploadResult.success ? uploadResult.url : videoUrl  // fallback to Creatomate URL

    // Update video_jobs row
    await supabase
      .from('video_jobs')
      .update({
        status: 'completed',
        video_url: finalVideoUrl,
        completed_at: new Date().toISOString(),
      })
      .eq('id', videoJob.id)

    // Update content_queue: set video_url + advance status to video_ready
    await supabase
      .from('content_queue')
      .update({
        status: 'video_ready',
        video_url: finalVideoUrl,
      })
      .eq('id', videoJob.queue_item_id)
      .eq('status', 'video_rendering')  // only advance if still in rendering state

    console.log(`[webhooks/creatomate] ✓ Render complete for queue item ${videoJob.queue_item_id}`)

  } else if (status === 'failed') {
    const errMsg = error_message ?? 'Unknown render error'

    await supabase
      .from('video_jobs')
      .update({
        status: 'failed',
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      })
      .eq('id', videoJob.id)

    // Roll back content_queue to 'approved' so the user can retry
    await supabase
      .from('content_queue')
      .update({ status: 'approved' })
      .eq('id', videoJob.queue_item_id)
      .eq('status', 'video_rendering')

    console.error(`[webhooks/creatomate] ✗ Render failed for queue item ${videoJob.queue_item_id}: ${errMsg}`)
  }

  return NextResponse.json({ received: true })
}
