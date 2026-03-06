// Supabase database types
// Run to regenerate: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts

import { ContentPackage, ReviewEdits } from '@/types/agents'
import { Platform, ReviewStatus } from '@/types/content'

export type Database = {
  public: {
    Tables: {
      series: {
        Row: {
          id: string
          user_id: string
          name: string
          niche: string
          tone: string
          length_seconds: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          niche: string
          tone: string
          length_seconds: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          niche?: string
          tone?: string
          length_seconds?: number
          created_at?: string
        }
      }

      content_queue: {
        Row: {
          id: string
          job_id: string
          user_id: string
          series_id: string
          platform: Platform
          status: ReviewStatus
          title: string
          hook: string
          package: ContentPackage         // immutable JSONB — never updated
          review_edits: ReviewEdits | null // human overrides — separate JSONB
          review_notes: string | null
          approved_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          generated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          user_id: string
          series_id: string
          platform: Platform
          status?: ReviewStatus
          title: string
          hook: string
          package: ContentPackage
          review_edits?: ReviewEdits | null
          review_notes?: string | null
          approved_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          generated_at: string
          created_at?: string
        }
        Update: {
          status?: ReviewStatus
          review_edits?: ReviewEdits | null
          review_notes?: string | null
          approved_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          // NOTE: `package` is intentionally absent — it must never be updated
        }
      }

      content_queue_events: {
        Row: {
          id: string
          queue_item_id: string
          user_id: string
          event: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          queue_item_id: string
          user_id: string
          event: string
          notes?: string | null
          created_at?: string
        }
        Update: never
      }
    }
  }
}
