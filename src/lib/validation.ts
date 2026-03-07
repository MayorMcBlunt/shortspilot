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
  return (
    typeof d?.hook === 'string' && d.hook.length > 0 &&
    typeof d?.body === 'string' && d.body.length > 0 &&
    typeof d?.cta === 'string' &&
    typeof d?.fullScript === 'string' && d.fullScript.length > 0 &&
    typeof d?.estimatedDurationSeconds === 'number'
  )
}

export function validateMediaOutput(data: unknown): data is MediaOutput {
  const d = data as MediaOutput
  return (
    Array.isArray(d?.scenes) && d.scenes.length > 0 &&
    typeof d?.overallStyle === 'string' &&
    typeof d?.thumbnailConcept === 'string'
  )
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


