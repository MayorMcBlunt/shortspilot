import { MediaOutput } from '@/types/agents'
import { PexelsVideo } from '@/lib/services/pexels'
import { Platform } from '@/types/platform'

const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY
const CREATOMATE_TEMPLATE_ID = process.env.CREATOMATE_TEMPLATE_ID
const CREATOMATE_API_URL = 'https://api.creatomate.com/v2/renders'

const STUB_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

export type CreatomateJobResult =
  | { success: true; externalJobId: string; isStub: boolean; requestPayload?: Record<string, unknown> }
  | { success: false; error: string }

export type CreatomateWebhookPayload = {
  id: string
  status: 'succeeded' | 'failed'
  url?: string
  error_message?: string
  metadata?: string
}

export async function dispatchRender(params: {
  jobId: string
  queueItemId: string
  platform: Platform
  audioUrl: string
  sceneClips: (PexelsVideo | null)[]
  media: MediaOutput
  sceneTexts: string[]
  durationSeconds: number
  webhookUrl: string
}): Promise<CreatomateJobResult> {
  if (!CREATOMATE_API_KEY) {
    console.log(`[creatomate STUB] Dispatching fake render for job ${params.jobId}`)
    const stubExternalId = `stub-${params.jobId}`
    return { success: true, externalJobId: stubExternalId, isStub: true }
  }

  if (!CREATOMATE_TEMPLATE_ID) {
    return {
      success: false,
      error: 'CREATOMATE_TEMPLATE_ID is required for template-based renders',
    }
  }

  const renderPayload = buildRenderPayload(params)

  try {
    const response = await fetch(CREATOMATE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CREATOMATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(renderPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Creatomate API error (${response.status}): ${errorText}` }
    }

    const data = await response.json()
    const externalJobId = data?.id ?? data?.[0]?.id

    if (!externalJobId) {
      return { success: false, error: 'Creatomate returned no render id' }
    }

    return {
      success: true,
      externalJobId,
      isStub: false,
      requestPayload: renderPayload,
    }
  } catch (err) {
    return {
      success: false,
      error: `Creatomate dispatch error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

function buildRenderPayload(params: {
  jobId: string
  queueItemId: string
  platform: Platform
  audioUrl: string
  sceneClips: (PexelsVideo | null)[]
  media: MediaOutput
  sceneTexts: string[]
  durationSeconds: number
  webhookUrl: string
}): Record<string, unknown> {
  const modifications: Record<string, unknown> = {
    'Music.source': params.audioUrl,
  }

  for (let i = 0; i < params.sceneClips.length; i++) {
    const idx = i + 1
    const clip = params.sceneClips[i]
    const text = params.sceneTexts[i] ?? params.media.scenes[i]?.scriptSegment ?? ''

    if (clip?.downloadUrl) {
      modifications[`Background-${idx}.source`] = clip.downloadUrl
    }

    if (text) {
      modifications[`Text-${idx}.text`] = text
    }
  }

  return {
    template_id: CREATOMATE_TEMPLATE_ID,
    modifications,
    webhook_url: params.webhookUrl,
    metadata: JSON.stringify({
      queueItemId: params.queueItemId,
      jobId: params.jobId,
      platform: params.platform,
      durationSeconds: params.durationSeconds,
    }),
  }
}

export function getStubVideoUrl(): string {
  return STUB_VIDEO_URL
}
