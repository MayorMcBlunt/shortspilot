// ─────────────────────────────────────────────────────────────────────────────
// Video generation types
// Separate from agents.ts — video rendering is not part of the AI text pipeline.
// ─────────────────────────────────────────────────────────────────────────────

export type VideoJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type VideoJobProvider = 'creatomate' | 'stub'

// One row in the video_jobs table — one render attempt per queue item
export type VideoJob = {
  id: string
  queue_item_id: string
  user_id: string
  status: VideoJobStatus
  provider: VideoJobProvider
  external_job_id: string | null   // Creatomate render ID — used to match webhooks
  audio_url: string | null         // OpenAI TTS output stored in Supabase Storage
  video_url: string | null         // final MP4 — populated on completion
  error_message: string | null
  render_metadata: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

// Lightweight summary returned from the render kick-off API
export type RenderJobResult =
  | { success: true; videoJobId: string; externalJobId: string | null }
  | { success: false; error: string }
