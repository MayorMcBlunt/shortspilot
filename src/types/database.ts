// Supabase database types
// Run to regenerate: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts

import { ContentPackage, ReviewEdits } from '@/types/agents'
import { Platform, ReviewStatus } from '@/types/content'
import { VideoJobStatus } from '@/types/video'
import { PublishJobStatus } from '@/types/publish'

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
          package: ContentPackage
          review_edits: ReviewEdits | null
          review_notes: string | null
          video_url: string | null
          published_at: string | null
          published_url: string | null
          last_publish_job_id: string | null
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
          video_url?: string | null
          published_at?: string | null
          published_url?: string | null
          last_publish_job_id?: string | null
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
          video_url?: string | null
          published_at?: string | null
          published_url?: string | null
          last_publish_job_id?: string | null
          approved_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
        }
      }

      video_jobs: {
        Row: {
          id: string
          queue_item_id: string
          user_id: string
          status: VideoJobStatus
          provider: string
          external_job_id: string | null
          audio_url: string | null
          video_url: string | null
          error_message: string | null
          render_metadata: Record<string, unknown> | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          queue_item_id: string
          user_id: string
          status?: VideoJobStatus
          provider?: string
          external_job_id?: string | null
          audio_url?: string | null
          video_url?: string | null
          error_message?: string | null
          render_metadata?: Record<string, unknown> | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          status?: VideoJobStatus
          provider?: string
          external_job_id?: string | null
          audio_url?: string | null
          video_url?: string | null
          error_message?: string | null
          render_metadata?: Record<string, unknown> | null
          completed_at?: string | null
        }
      }

      connected_accounts: {
        Row: {
          id: string
          user_id: string
          platform: 'youtube'
          account_external_id: string
          account_name: string | null
          scopes: string[]
          access_token_encrypted: string
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          is_active: boolean
          connected_at: string
          last_refreshed_at: string | null
          disconnected_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          platform: 'youtube'
          account_external_id: string
          account_name?: string | null
          scopes?: string[]
          access_token_encrypted: string
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          is_active?: boolean
          connected_at?: string
          last_refreshed_at?: string | null
          disconnected_at?: string | null
        }
        Update: {
          account_name?: string | null
          scopes?: string[]
          access_token_encrypted?: string
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          is_active?: boolean
          last_refreshed_at?: string | null
          disconnected_at?: string | null
        }
      }

      oauth_states: {
        Row: {
          id: string
          user_id: string
          platform: 'youtube'
          state: string
          code_verifier_encrypted: string
          redirect_uri: string
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: 'youtube'
          state: string
          code_verifier_encrypted: string
          redirect_uri: string
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          used_at?: string | null
        }
      }

      publish_jobs: {
        Row: {
          id: string
          queue_item_id: string
          user_id: string
          platform: 'youtube'
          connected_account_id: string
          status: PublishJobStatus
          title: string | null
          description: string | null
          external_post_id: string | null
          external_post_url: string | null
          error_message: string | null
          attempt_count: number
          request_payload: Record<string, unknown> | null
          response_payload: Record<string, unknown> | null
          created_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          queue_item_id: string
          user_id: string
          platform: 'youtube'
          connected_account_id: string
          status?: PublishJobStatus
          title?: string | null
          description?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          error_message?: string | null
          attempt_count?: number
          request_payload?: Record<string, unknown> | null
          response_payload?: Record<string, unknown> | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          status?: PublishJobStatus
          title?: string | null
          description?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          error_message?: string | null
          attempt_count?: number
          request_payload?: Record<string, unknown> | null
          response_payload?: Record<string, unknown> | null
          started_at?: string | null
          completed_at?: string | null
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
