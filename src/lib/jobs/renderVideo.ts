import { createClient } from '@/lib/supabase/server'
import { generateVoiceover } from '@/lib/services/openaiTts'
import { fetchSceneClips, PexelsVideo } from '@/lib/services/pexels'
import { dispatchRender, getStubVideoUrl } from '@/lib/services/creatomate'
import { RenderJobResult } from '@/types/video'
import { ContentQueueItemFull } from '@/types/content'

async function rollbackToApproved(itemId: string, userId: string, reason: string): Promise<void> {
  console.error(`[renderVideo] Rolling back to approved: ${reason}`)
  const supabase = await createClient()
  await supabase
    .from('content_queue')
    .update({ status: 'approved' })
    .eq('id', itemId)
    .eq('user_id', userId)
}

export async function renderVideoForQueueItem(
  item: ContentQueueItemFull,
  userId: string
): Promise<RenderJobResult> {
  const supabase = await createClient()
  const pkg = item.package
  const edits = item.review_edits ?? {}

  const finalScript = edits.fullScript ?? pkg.script.fullScript
  const jobId = item.job_id

  console.log(`[renderVideo] Generating TTS for job ${jobId}`)
  let ttsResult: Awaited<ReturnType<typeof generateVoiceover>>
  try {
    ttsResult = await generateVoiceover(finalScript, jobId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await rollbackToApproved(item.id, userId, `TTS threw: ${msg}`)
    return { success: false, error: `TTS failed: ${msg}` }
  }

  if (!ttsResult.success) {
    await rollbackToApproved(item.id, userId, `TTS error: ${ttsResult.error}`)
    return { success: false, error: `TTS failed: ${ttsResult.error}` }
  }

  const audioUrl = ttsResult.audioStorageUrl ?? ttsResult.audioDataUrl
  if (!ttsResult.audioStorageUrl) {
    console.warn('[renderVideo] No audio storage URL available. Base64 audio may fail with Creatomate.')
  }

  if (process.env.CREATOMATE_API_KEY && !ttsResult.audioStorageUrl) {
    await rollbackToApproved(item.id, userId, 'Audio URL is not publicly accessible for Creatomate')
    return {
      success: false,
      error: 'Audio upload failed. Creatomate requires a public https URL for Music.source.',
    }
  }

  const assetGuidances = pkg.media.scenes.map((s) => s.assetGuidance)
  const sceneContexts = pkg.media.scenes.map((scene) => ({
    sceneText: scene.scriptSegment,
    theme: pkg.strategy.theme,
  }))
  console.log(`[renderVideo] Fetching ${assetGuidances.length} Pexels clips`)

  let sceneClips: (PexelsVideo | null)[]
  try {
    sceneClips = await fetchSceneClips(assetGuidances, sceneContexts)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await rollbackToApproved(item.id, userId, `Pexels threw: ${msg}`)
    return { success: false, error: `Pexels fetch failed: ${msg}` }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const webhookSecret = process.env.CREATOMATE_WEBHOOK_SECRET?.trim()
  const webhookBaseUrl = `${appUrl}/api/webhooks?provider=creatomate`
  const webhookUrl = webhookSecret
    ? `${webhookBaseUrl}&token=${encodeURIComponent(webhookSecret)}`
    : webhookBaseUrl
  console.log(`[renderVideo] Dispatching render for job ${jobId}`)

  let renderResult: Awaited<ReturnType<typeof dispatchRender>>
  try {
    renderResult = await dispatchRender({
      jobId,
      queueItemId: item.id,
      platform: pkg.platform,
      audioUrl,
      sceneClips,
      media: pkg.media,
      sceneTexts: pkg.media.scenes.map((scene) => scene.scriptSegment),
      durationSeconds: ttsResult.durationEstimateSeconds,
      webhookUrl,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await rollbackToApproved(item.id, userId, `dispatchRender threw: ${msg}`)
    return { success: false, error: `Render dispatch failed: ${msg}` }
  }

  if (!renderResult.success) {
    await rollbackToApproved(item.id, userId, `dispatchRender failed: ${renderResult.error}`)
    return { success: false, error: `Render dispatch failed: ${renderResult.error}` }
  }

  const { data: videoJob, error: insertError } = await supabase
    .from('video_jobs')
    .insert({
      queue_item_id: item.id,
      user_id: userId,
      status: renderResult.isStub ? 'completed' : 'processing',
      provider: renderResult.isStub ? 'stub' : 'creatomate',
      external_job_id: renderResult.externalJobId,
      audio_url: ttsResult.audioStorageUrl ?? null,
      video_url: renderResult.isStub ? getStubVideoUrl() : null,
      render_metadata: {
        sceneCount: pkg.media.scenes.length,
        clipsFound: sceneClips.filter(Boolean).length,
        scriptWordCount: finalScript.split(/\s+/).length,
        durationSeconds: ttsResult.durationEstimateSeconds,
        audioStoragePath: ttsResult.storagePath ?? 'not-uploaded',
        isStub: renderResult.isStub,
      },
      completed_at: renderResult.isStub ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (insertError || !videoJob) {
    const msg = insertError?.message ?? 'unknown insert error'
    await rollbackToApproved(item.id, userId, `video_jobs insert failed: ${msg}`)
    return { success: false, error: `Failed to create video_jobs row: ${msg}` }
  }

  if (renderResult.isStub) {
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({ status: 'video_ready', video_url: getStubVideoUrl() })
      .eq('id', item.id)
      .eq('user_id', userId)

    if (updateError) {
      console.error('[renderVideo] Failed to set video_ready on stub:', updateError.message)
    }
  }

  return {
    success: true,
    videoJobId: videoJob.id,
    externalJobId: renderResult.externalJobId,
  }
}
