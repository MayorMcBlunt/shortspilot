// ─────────────────────────────────────────────────────────────────────────────
// Central validation constants and helpers
// Single source of truth — import from here, never redefine elsewhere
// ─────────────────────────────────────────────────────────────────────────────

import { ReviewStatus, ReviewEdits } from '@/types/agents'
import { Platform, PLATFORM_CONFIGS } from '@/types/platform'
import {
  StrategyOutput,
  ScriptOutput,
  MediaOutput,
  CaptionOutput,
} from '@/types/agents'
import { TEMPLATE_SEGMENT_COUNT } from '@/lib/ai/prompts/script'

// ── Valid enum values as runtime arrays ───────────────────────────────────────

export const VALID_REVIEW_STATUSES: ReviewStatus[] = [
  'pending_review',
  'needs_edits',
  'approved',
  'video_rendering',
  'video_ready',
  'ready_to_publish',
  'rejected',
  'published',
]

export const VALID_PLATFORMS: Platform[] = Object.keys(PLATFORM_CONFIGS) as Platform[]

// Actions a reviewer can take via PATCH /api/queue/[id]
export type ReviewAction =
  | 'approve'
  | 'reject'
  | 'request_edits'
  | 'update_notes'
  | 'save_edits'
  | 'mark_ready_to_publish'
  | 'request_video_render'   // kick off TTS + video assembly

export const VALID_REVIEW_ACTIONS: ReviewAction[] = [
  'approve',
  'reject',
  'request_edits',
  'update_notes',
  'save_edits',
  'mark_ready_to_publish',
  'request_video_render',
]

// Statuses that block a new video render (render already in flight or done)
export const VIDEO_RENDER_BLOCKING_STATUSES: ReviewStatus[] = [
  'video_rendering',
  'video_ready',
  'ready_to_publish',
  'published',
]

// ── Type guards ───────────────────────────────────────────────────────────────

export function isValidPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && VALID_PLATFORMS.includes(value as Platform)
}

export function isValidReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === 'string' && VALID_REVIEW_STATUSES.includes(value as ReviewStatus)
}

export function isValidReviewAction(value: unknown): value is ReviewAction {
  return typeof value === 'string' && VALID_REVIEW_ACTIONS.includes(value as ReviewAction)
}

export const VALID_VIDEO_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const
export type VideoJobStatusValue = typeof VALID_VIDEO_JOB_STATUSES[number]

export function isValidVideoJobStatus(value: unknown): value is VideoJobStatusValue {
  return typeof value === 'string' && (VALID_VIDEO_JOB_STATUSES as readonly string[]).includes(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

// ── ReviewEdits validator ─────────────────────────────────────────────────────
// All fields are optional overrides — we just verify types when present

export function validateReviewEdits(data: unknown): data is ReviewEdits {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if ('title' in d && typeof d.title !== 'string') return false
  if ('hook' in d && typeof d.hook !== 'string') return false
  if ('fullScript' in d && typeof d.fullScript !== 'string') return false
  if ('primaryCaption' in d && typeof d.primaryCaption !== 'string') return false
  if ('hashtags' in d && (!Array.isArray(d.hashtags) || !d.hashtags.every(h => typeof h === 'string'))) return false
  return true
}

// ── Agent output validators ───────────────────────────────────────────────────

export function validateStrategyOutput(data: unknown): data is StrategyOutput {
  const d = data as StrategyOutput
  return (
    typeof d?.theme === 'string' && d.theme.length > 0 &&
    typeof d?.angle === 'string' &&
    Array.isArray(d?.hooks) && d.hooks.length > 0 &&
    typeof d?.targetEmotion === 'string' &&
    Array.isArray(d?.talkingPoints) && d.talkingPoints.length > 0 &&
    typeof d?.positioning === 'string'
  )
}

export function validateScriptOutput(data: unknown): data is ScriptOutput {
  const d = data as ScriptOutput

  // Structural checks
  if (typeof d?.hook !== 'string' || d.hook.trim().length === 0) return false
  // segments must be exactly TEMPLATE_SEGMENT_COUNT (currently 2).
  // Too few = not enough scenes; too many = overflow silently dropped by Creatomate → black gaps.
  if (!Array.isArray(d?.segments) || d.segments.length !== TEMPLATE_SEGMENT_COUNT) {
    console.warn(
      `[validateScriptOutput] Expected exactly ${TEMPLATE_SEGMENT_COUNT} segments, ` +
      `got ${Array.isArray(d?.segments) ? d.segments.length : 'non-array'}`
    )
    return false
  }
  if (d.segments.some(s => typeof s !== 'string' || s.trim().length === 0)) return false
  if (typeof d?.ending !== 'string' || d.ending.trim().length === 0) return false
  if (typeof d?.fullScript !== 'string' || d.fullScript.trim().length === 0) return false
  if (typeof d?.estimatedDurationSeconds !== 'number') return false

  // Word count check — re-derive from structured fields.
  // estimatedDurationSeconds is now the midpoint of the target range, not a hard cap.
  // We use a generous 60% lower bound to reject obviously undersized scripts while
  // allowing natural variation (a 20–30s series whose script hits 19s is fine).
  const TTS_WORDS_PER_SECOND = 2.8
  const assembled = [d.hook, ...d.segments, d.ending].join(' ')
  const wordCount = assembled.trim().split(/\s+/).length
  const minExpectedWords = Math.round(d.estimatedDurationSeconds * TTS_WORDS_PER_SECOND * 0.6)
  if (wordCount < minExpectedWords) {
    console.warn(
      `[validateScriptOutput] Script too short: ${wordCount} assembled words for a ` +
      `${d.estimatedDurationSeconds}s target (expected >=${minExpectedWords}).`
    )
    return false
  }

  return true
}

export function validateMediaOutput(data: unknown): data is MediaOutput {
  const d = data as MediaOutput
  if (!Array.isArray(d?.scenes) || d.scenes.length === 0) return false
  if (typeof d?.overallStyle !== 'string') return false
  if (typeof d?.thumbnailConcept !== 'string') return false

  // Scene count must match the template's slot count exactly.
  // Extra scenes overflow silently; missing scenes leave black slots.
  const TEMPLATE_TOTAL_SCENES = TEMPLATE_SEGMENT_COUNT + 2 // segments + hook + ending
  if (d.scenes.length !== TEMPLATE_TOTAL_SCENES) {
    console.warn(
      `[validateMediaOutput] Expected exactly ${TEMPLATE_TOTAL_SCENES} scenes, got ${d.scenes.length}`
    )
    return false
  }

  return true
}

export function validateCaptionOutput(data: unknown): data is CaptionOutput {
  const d = data as CaptionOutput
  return (
    typeof d?.primaryCaption === 'string' && d.primaryCaption.length > 0 &&
    Array.isArray(d?.hashtags) &&
    typeof d?.title === 'string' && d.title.length > 0 &&
    Array.isArray(d?.ctaVariations)
  )
}


