// ─────────────────────────────────────────────
// Agent I/O Types
// ─────────────────────────────────────────────

import { Series } from '@/types/series'
import { Platform } from '@/types/platform'

export type AgentContext = {
  series: Series
  platform: Platform
  userId: string
  jobId: string
}

export type StrategyInput = { context: AgentContext }

export type StrategyOutput = {
  theme: string
  angle: string
  hooks: string[]
  targetEmotion: string
  talkingPoints: string[]
  positioning: string
}

export type ScriptInput = {
  context: AgentContext
  strategy: StrategyOutput
}

export type ScriptOutput = {
  hook: string
  body: string
  cta: string
  fullScript: string
  estimatedDurationSeconds: number
  wordCount: number
}

export type MediaInput = {
  context: AgentContext
  strategy: StrategyOutput
  script: ScriptOutput
}

export type SceneNote = {
  sceneNumber: number
  scriptSegment: string
  visualDescription: string
  cameraDirection: string
  editingNote: string
  assetGuidance: string
}

export type MediaOutput = {
  scenes: SceneNote[]
  overallStyle: string
  colorGrading: string
  musicMood: string
  textOverlays: string[]
  thumbnailConcept: string
}

export type CaptionInput = {
  context: AgentContext
  strategy: StrategyOutput
  script: ScriptOutput
}

export type CaptionOutput = {
  primaryCaption: string
  alternativeCaptions: string[]
  hashtags: string[]
  title: string
  ctaVariations: string[]
  platformNotes: string
}

export type PackagingInput = {
  context: AgentContext
  strategy: StrategyOutput
  script: ScriptOutput
  media: MediaOutput
  caption: CaptionOutput
}

// ── Content Package ───────────────────────────────────────────────────────────
// IMMUTABLE after creation. Stored as JSONB in content_queue.package.
// Never modified — review overrides live in content_queue.review_edits.
export type ContentPackage = {
  jobId: string
  userId: string
  seriesId: string
  platform: Platform
  generatedAt: string
  strategy: StrategyOutput
  script: ScriptOutput
  media: MediaOutput
  caption: CaptionOutput
}

// ── Review Edits ──────────────────────────────────────────────────────────────
// Human overrides applied on top of the immutable ContentPackage.
// Stored separately in content_queue.review_edits (JSONB).
// The UI merges: { ...package.field, ...review_edits.field } to show final values.
// All fields optional — only overridden fields are stored.
export type ReviewEdits = {
  title?: string
  hook?: string
  fullScript?: string
  primaryCaption?: string
  hashtags?: string[]
  reviewNotes?: string
}

// ── Review Status ─────────────────────────────────────────────────────────────
export type ReviewStatus =
  | 'pending_review'    // just generated, awaiting human eyes
  | 'needs_edits'       // flagged for editing before approval
  | 'approved'          // human approved
  | 'ready_to_publish'  // approved + explicitly queued for manual publishing
  | 'rejected'          // human rejected
  | 'published'         // manually published from the UI

// ── Agent Result wrapper ──────────────────────────────────────────────────────
export type AgentResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
