import { ReviewStatus, ReviewEdits, ContentPackage } from '@/types/agents'
import { Platform } from '@/types/platform'

export type { Platform }
export type { ReviewStatus }
export type { ReviewEdits }
export type { ContentPackage }

// Lightweight row for listing the queue — no JSONB blobs needed
export type ContentQueueRow = {
  id: string
  job_id: string
  user_id: string
  series_id: string
  platform: Platform
  status: ReviewStatus
  title: string
  hook: string
  review_notes: string | null
  review_edits: ReviewEdits | null   // human overrides — never touches package
  video_url: string | null           // rendered MP4 URL — set after video_ready
  approved_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  generated_at: string
  created_at: string
}

// Full item including the immutable generated package
export type ContentQueueItemFull = ContentQueueRow & {
  package: ContentPackage
}
