import { createClient } from '@/lib/supabase/server'
import { decryptSecret, encryptSecret } from '@/lib/security/tokens'
import { publishToYouTube } from '@/lib/services/youtube'
import { refreshYoutubeToken } from '@/lib/services/youtubeOAuth'
import type { ContentQueueItemFull } from '@/types/content'

type ConnectedAccountRow = {
  id: string
  user_id: string
  platform: 'youtube'
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  token_expires_at: string | null
  is_active: boolean
}

type InFlightPublishJob = {
  id: string
  status: string
}

type PublishResult =
  | { success: true; publishJobId: string; externalPostUrl: string }
  | { success: false; error: string; statusCode?: number; publishJobId?: string }

const IN_FLIGHT_STATUSES = ['queued', 'validating', 'refreshing_token', 'uploading', 'processing'] as const

function shouldRefresh(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const ms = new Date(expiresAt).getTime() - Date.now()
  return ms < 5 * 60 * 1000
}

async function updateJobStatus(
  jobId: string,
  status: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('publish_jobs').update({ status, ...extra }).eq('id', jobId)
}

async function findInFlightJob(queueItemId: string, userId: string): Promise<InFlightPublishJob | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('publish_jobs')
    .select('id, status')
    .eq('queue_item_id', queueItemId)
    .eq('user_id', userId)
    .in('status', [...IN_FLIGHT_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as InFlightPublishJob
}

async function claimQueueForPublish(params: {
  queueItemId: string
  userId: string
  publishJobId: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('content_queue')
    .update({ last_publish_job_id: params.publishJobId })
    .eq('id', params.queueItemId)
    .eq('user_id', params.userId)
    .eq('status', 'ready_to_publish')
    .is('last_publish_job_id', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === '42703') {
      // Older schema without last_publish_job_id - skip hard claim.
      return { ok: true }
    }
    return { ok: false, error: error.message }
  }

  if (!data) {
    return { ok: false, error: 'Queue item is already claimed by another publish job.' }
  }

  return { ok: true }
}

async function releaseQueueClaim(queueItemId: string, userId: string, publishJobId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('content_queue')
    .update({ last_publish_job_id: null })
    .eq('id', queueItemId)
    .eq('user_id', userId)
    .eq('status', 'ready_to_publish')
    .eq('last_publish_job_id', publishJobId)
}

export async function executeYouTubePublish(params: {
  item: ContentQueueItemFull
  userId: string
  connectedAccountId?: string
  title?: string
  description?: string
}): Promise<PublishResult> {
  const existingInFlight = await findInFlightJob(params.item.id, params.userId)
  if (existingInFlight) {
    return {
      success: false,
      statusCode: 409,
      publishJobId: existingInFlight.id,
      error: `A publish job is already in progress (${existingInFlight.status}).`,
    }
  }

  const supabase = await createClient()

  const q = supabase
    .from('connected_accounts')
    .select('id, user_id, platform, access_token_encrypted, refresh_token_encrypted, token_expires_at, is_active')
    .eq('user_id', params.userId)
    .eq('platform', 'youtube')
    .eq('is_active', true)

  const accountQuery = params.connectedAccountId
    ? q.eq('id', params.connectedAccountId).maybeSingle()
    : q.order('connected_at', { ascending: false }).limit(1).maybeSingle()

  const { data: account, error: accountError } = await accountQuery

  if (accountError) {
    return { success: false, error: accountError.message }
  }

  if (!account) {
    return { success: false, error: 'No active YouTube account connected' }
  }

  const finalTitle = (params.title ?? params.item.review_edits?.title ?? params.item.title).trim()
  const caption = params.item.review_edits?.primaryCaption ?? params.item.package.caption.primaryCaption
  const hashtags = params.item.review_edits?.hashtags ?? params.item.package.caption.hashtags
  const finalDescription = (params.description ?? `${caption}\n\n${hashtags.join(' ')}`).trim()

  const { data: job, error: createJobError } = await supabase
    .from('publish_jobs')
    .insert({
      queue_item_id: params.item.id,
      user_id: params.userId,
      platform: 'youtube',
      connected_account_id: account.id,
      status: 'queued',
      title: finalTitle,
      description: finalDescription,
      request_payload: {
        hasVideoUrl: Boolean(params.item.video_url),
        sourceStatus: params.item.status,
      },
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (createJobError || !job) {
    return { success: false, error: createJobError?.message ?? 'Failed to create publish job' }
  }

  const claim = await claimQueueForPublish({
    queueItemId: params.item.id,
    userId: params.userId,
    publishJobId: job.id,
  })

  if (!claim.ok) {
    await updateJobStatus(job.id, 'canceled', {
      error_message: claim.error,
      completed_at: new Date().toISOString(),
    })

    return {
      success: false,
      statusCode: 409,
      publishJobId: job.id,
      error: claim.error ?? 'Publish claim failed',
    }
  }

  let uploadResult: Awaited<ReturnType<typeof publishToYouTube>> | null = null

  try {
    await updateJobStatus(job.id, 'validating')

    let accessToken = decryptSecret((account as ConnectedAccountRow).access_token_encrypted)

    if (shouldRefresh((account as ConnectedAccountRow).token_expires_at)) {
      if (!(account as ConnectedAccountRow).refresh_token_encrypted) {
        throw new Error('YouTube token expired and no refresh token is available. Reconnect account.')
      }

      await updateJobStatus(job.id, 'refreshing_token')
      const refreshToken = decryptSecret((account as ConnectedAccountRow).refresh_token_encrypted!)
      const refreshed = await refreshYoutubeToken(refreshToken)
      accessToken = refreshed.access_token

      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      const updates: Record<string, unknown> = {
        access_token_encrypted: encryptSecret(refreshed.access_token),
        token_expires_at: expiresAt,
        last_refreshed_at: new Date().toISOString(),
      }

      if (refreshed.refresh_token) {
        updates.refresh_token_encrypted = encryptSecret(refreshed.refresh_token)
      }

      await supabase.from('connected_accounts').update(updates).eq('id', account.id)
    }

    await updateJobStatus(job.id, 'uploading')

    uploadResult = await publishToYouTube(accessToken, params.item.video_url!, finalTitle, finalDescription)
    const completedAt = new Date().toISOString()

    const { data: updatedQueueItem, error: queueUpdateError } = await supabase
      .from('content_queue')
      .update({
        status: 'published',
        published_at: completedAt,
        published_url: uploadResult.videoUrl,
        last_publish_job_id: job.id,
      })
      .eq('id', params.item.id)
      .eq('user_id', params.userId)
      .eq('status', 'ready_to_publish')
      .select('id')
      .maybeSingle()

    if (queueUpdateError || !updatedQueueItem) {
      const queueFailureMessage = queueUpdateError
        ? `Queue publish state update failed after upload: ${queueUpdateError.message}`
        : 'Queue publish state update failed after upload: status changed during publish.'

      await updateJobStatus(job.id, 'completed', {
        external_post_id: uploadResult.videoId,
        external_post_url: uploadResult.videoUrl,
        response_payload: uploadResult.responsePayload ?? null,
        error_message: queueFailureMessage,
        completed_at: completedAt,
      })

      return {
        success: false,
        statusCode: 409,
        publishJobId: job.id,
        error: 'Uploaded to YouTube, but ShortsPilot could not finalize local publish state. Do not retry until reconciled.',
      }
    }

    await updateJobStatus(job.id, 'completed', {
      external_post_id: uploadResult.videoId,
      external_post_url: uploadResult.videoUrl,
      response_payload: uploadResult.responsePayload ?? null,
      error_message: null,
      completed_at: completedAt,
    })

    await supabase.from('content_queue_events').insert({
      queue_item_id: params.item.id,
      user_id: params.userId,
      event: 'published',
      notes: uploadResult.videoUrl,
    })

    return {
      success: true,
      publishJobId: job.id,
      externalPostUrl: uploadResult.videoUrl,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publishing failed'

    if (uploadResult) {
      await updateJobStatus(job.id, 'completed', {
        external_post_id: uploadResult.videoId,
        external_post_url: uploadResult.videoUrl,
        response_payload: uploadResult.responsePayload ?? null,
        error_message: `Uploaded to YouTube, but local finalization failed: ${message}`,
        completed_at: new Date().toISOString(),
      })

      return {
        success: false,
        statusCode: 409,
        publishJobId: job.id,
        error: 'Uploaded to YouTube, but ShortsPilot could not finish local finalization. Do not retry until reconciled.',
      }
    }

    await updateJobStatus(job.id, 'failed', {
      error_message: message,
      completed_at: new Date().toISOString(),
    })
    await releaseQueueClaim(params.item.id, params.userId, job.id)
    return { success: false, error: message }
  }
}
