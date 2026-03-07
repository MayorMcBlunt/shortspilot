import { MediaOutput } from '@/types/agents'
import { PexelsVideo } from '@/lib/services/pexels'
import { Platform } from '@/types/platform'
import { TTS_WORDS_PER_SECOND, TEMPLATE_SCENE_COUNT } from '@/lib/ai/prompts/script'

const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY
const CREATOMATE_TEMPLATE_ID = process.env.CREATOMATE_TEMPLATE_ID
const CREATOMATE_API_URL = 'https://api.creatomate.com/v2/renders'

const STUB_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

// ── Template slot type map ────────────────────────────────────────────────────
// The Creatomate "Storytelling Video" template uses:
//   Slot 1 → Composition-1 → Background-1  type: "image"
//   Slot 2 → Composition-2 → Background-2  type: "image"
//   Slot 3 → Composition-3 → Background-3  type: "video"
//   Slot 4 → Composition-4 → Background-4  type: "video"
//
// CRITICAL: Sending an MP4 URL to an image-type slot produces a black frame
// or a frozen still. We must send thumbnailUrl (JPEG) to slots 1–2, and
// downloadUrl (MP4) to slots 3–4.
//
// If the template is ever regenerated with different slot types, update this map.
const SLOT_TYPE: Record<number, 'image' | 'video'> = {
  1: 'image',
  2: 'image',
  3: 'video',
  4: 'video',
}

// ── Fallback assets ───────────────────────────────────────────────────────────
// Used when Pexels returns null AND there is no lastGoodClip to reuse.
// These are public, reliable URLs. The image fallback is a solid dark gradient
// that works as a neutral background and avoids a fully black frame.
//
// In practice the fallback should almost never trigger — fetchSceneClips
// already reuses the last good clip. This is the last line of defence.
const FALLBACK_STILL_URL =
  'https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg?auto=compress&cs=tinysrgb&w=720'
const FALLBACK_VIDEO_URL =
  'https://videos.pexels.com/video-files/856271/856271-hd_720_1280_25fps.mp4'

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

// ── Timeline integrity check ──────────────────────────────────────────────────
// Validates the assembled render params before sending to Creatomate.
// Returns a list of problems found; empty array = OK to send.
export function validateTimeline(params: {
  sceneClips: (PexelsVideo | null)[]
  sceneTexts: string[]
  durationSeconds: number
}): string[] {
  const problems: string[] = []
  const { sceneClips, sceneTexts, durationSeconds } = params

  if (sceneClips.length !== TEMPLATE_SCENE_COUNT) {
    problems.push(
      `Expected exactly ${TEMPLATE_SCENE_COUNT} scene clips, got ${sceneClips.length}. ` +
      `Excess scenes will be silently dropped by Creatomate, leaving black frames.`
    )
  }

  if (sceneTexts.length !== TEMPLATE_SCENE_COUNT) {
    problems.push(
      `Expected exactly ${TEMPLATE_SCENE_COUNT} scene texts, got ${sceneTexts.length}.`
    )
  }

  const nullCount = sceneClips.filter((c) => c === null).length
  if (nullCount > 0) {
    problems.push(
      `${nullCount} of ${sceneClips.length} clips are null. ` +
      `Null slots will use fallback assets — visual quality may be poor.`
    )
  }

  // Check that the sum of per-clip durations roughly matches the total audio length.
  // A large mismatch means clips will be stretched or cut unexpectedly.
  const TTS_WPS = TTS_WORDS_PER_SECOND
  const summedDuration = sceneTexts.reduce((acc, text) => {
    const words = text.trim().split(/\s+/).length
    return acc + words / TTS_WPS + 0.15
  }, 0)

  const drift = Math.abs(summedDuration - durationSeconds)
  if (drift > 3) {
    problems.push(
      `Per-clip duration sum (${summedDuration.toFixed(1)}s) differs from TTS audio ` +
      `(${durationSeconds}s) by ${drift.toFixed(1)}s. Check word counts vs TTS speed.`
    )
  }

  return problems
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
    return { success: true, externalJobId: `stub-${params.jobId}`, isStub: true }
  }

  if (!CREATOMATE_TEMPLATE_ID) {
    return { success: false, error: 'CREATOMATE_TEMPLATE_ID is required for template-based renders' }
  }

  // ── Pre-flight timeline integrity check ──────────────────────────────────
  const problems = validateTimeline({
    sceneClips: params.sceneClips,
    sceneTexts: params.sceneTexts,
    durationSeconds: params.durationSeconds,
  })

  if (problems.length > 0) {
    // Log all problems but only block on critical ones (wrong scene count).
    const isCritical = problems.some((p) => p.includes('Expected exactly'))
    for (const p of problems) {
      console[isCritical ? 'error' : 'warn'](`[creatomate] timeline issue: ${p}`)
    }
    if (isCritical) {
      return {
        success: false,
        error: `Timeline validation failed: ${problems[0]}`,
      }
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

    return { success: true, externalJobId, isStub: false, requestPayload: renderPayload }
  } catch (err) {
    return {
      success: false,
      error: `Creatomate dispatch error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ── Per-clip duration ─────────────────────────────────────────────────────────
// Derived from word count of the segment — makes each clip's screen time
// match how long the TTS voice spends on that sentence.
const CLIP_TRANSITION_BUFFER_SECONDS = 0.15

function clipDurationFromSegment(segmentText: string): number {
  const words = segmentText.trim().split(/\s+/).length
  const speechSeconds = words / TTS_WORDS_PER_SECOND
  return Math.round((speechSeconds + CLIP_TRANSITION_BUFFER_SECONDS) * 10) / 10
}

// ── Render payload assembly ───────────────────────────────────────────────────
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
    // Override the template's fixed duration with the actual TTS audio length.
    'duration': params.durationSeconds,
    'Music.source': params.audioUrl,
  }

  // Only process up to the template's slot count — extra scenes would be silently
  // ignored by Creatomate and could cause duration mismatches.
  const slotCount = Math.min(params.sceneClips.length, TEMPLATE_SCENE_COUNT)

  for (let i = 0; i < slotCount; i++) {
    const idx = i + 1  // Creatomate slots are 1-indexed
    const clip = params.sceneClips[i]
    const text = params.sceneTexts[i] ?? params.media.scenes[i]?.scriptSegment ?? ''
    const slotType = SLOT_TYPE[idx] ?? 'video'
    const clipDuration = text ? clipDurationFromSegment(text) : undefined

    // ── Background source ───────────────────────────────────────────────────
    // Slot type determines which asset URL to use:
    //   "image" slots (1, 2) → JPEG still (thumbnailUrl)
    //   "video" slots (3, 4) → MP4 (downloadUrl)
    // Sending an MP4 to an image slot produces a black frame.
    // Sending a JPEG to a video slot would also break — keep these separate.
    if (clip) {
      const sourceUrl = slotType === 'image' ? clip.thumbnailUrl : clip.downloadUrl
      if (sourceUrl) {
        modifications[`Background-${idx}.source`] = sourceUrl
      } else {
        // Clip object exists but the expected URL field is empty — use fallback
        console.warn(`[creatomate] clip ${clip.id} has no ${slotType === 'image' ? 'thumbnailUrl' : 'downloadUrl'} — using fallback`)
        modifications[`Background-${idx}.source`] = slotType === 'image'
          ? FALLBACK_STILL_URL
          : FALLBACK_VIDEO_URL
      }
    } else {
      // No clip at all — must always write a source or this slot will be black.
      console.warn(`[creatomate] slot ${idx} has no clip — using hardcoded fallback`)
      modifications[`Background-${idx}.source`] = slotType === 'image'
        ? FALLBACK_STILL_URL
        : FALLBACK_VIDEO_URL
    }

    // ── Composition duration ────────────────────────────────────────────────
    // Set on both Background and Text so they stay in sync.
    // Without this, Creatomate uses the template's fixed duration per composition.
    if (clipDuration) {
      modifications[`Background-${idx}.duration`] = clipDuration
    }

    // ── Text overlay ────────────────────────────────────────────────────────
    if (text) {
      modifications[`Text-${idx}.text`] = text
      if (clipDuration) {
        modifications[`Text-${idx}.duration`] = clipDuration
      }
    }
  }

  const payload = {
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

  console.log(`[creatomate] render payload for job ${params.jobId}:`, JSON.stringify(payload, null, 2))

  return payload
}

export function getStubVideoUrl(): string {
  return STUB_VIDEO_URL
}
