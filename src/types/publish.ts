export type ConnectedPlatform = 'youtube'

export type ConnectedAccountStatus = 'active' | 'disconnected'

export type PublishJobStatus =
  | 'queued'
  | 'validating'
  | 'refreshing_token'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'canceled'

export type ConnectedAccount = {
  id: string
  user_id: string
  platform: ConnectedPlatform
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

export type PublishJob = {
  id: string
  queue_item_id: string
  user_id: string
  platform: ConnectedPlatform
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
