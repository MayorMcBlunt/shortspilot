import { createClient } from '@/lib/supabase/server'
import { ReviewStatus, ReviewEdits } from '@/types/agents'
import { ContentQueueRow, ContentQueueItemFull } from '@/types/content'

type ActionResult = {
  success: boolean
  error?: string
  statusCode?: number
  deletedCount?: number
  deletedIds?: string[]
}

const EDITABLE_STATUSES: ReviewStatus[] = [
  'pending_review',
  'needs_edits',
  'approved',
  'ready_to_publish',
]

async function updateQueueItem(
  id: string,
  userId: string,
  updates: Record<string, unknown>,
  options?: { allowedFrom?: ReviewStatus[]; transitionName?: string }
): Promise<ActionResult> {
  const supabase = await createClient()

  let query = supabase
    .from('content_queue')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (options?.allowedFrom && options.allowedFrom.length > 0) {
    query = query.in('status', options.allowedFrom)
  }

  const { data, error } = await query.select('id').maybeSingle()

  if (error) {
    return { success: false, error: error.message, statusCode: 500 }
  }

  if (!data) {
    if (options?.allowedFrom) {
      return {
        success: false,
        error: `Invalid status transition for ${options.transitionName ?? 'action'}`,
        statusCode: 409,
      }
    }

    return { success: false, error: 'Queue item not found', statusCode: 404 }
  }

  return { success: true }
}

export async function approveContent(id: string, userId: string): Promise<ActionResult> {
  const result = await updateQueueItem(
    id,
    userId,
    {
      status: 'approved' as ReviewStatus,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      rejection_reason: null,
    },
    { allowedFrom: ['pending_review', 'needs_edits'], transitionName: 'approve' }
  )

  if (!result.success) return result
  await logQueueEvent(id, userId, 'approved')
  return { success: true }
}

export async function rejectContent(
  id: string,
  userId: string,
  reason: string
): Promise<ActionResult> {
  const result = await updateQueueItem(
    id,
    userId,
    {
      status: 'rejected' as ReviewStatus,
      approved_at: null,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    },
    { allowedFrom: EDITABLE_STATUSES, transitionName: 'reject' }
  )

  if (!result.success) return result
  await logQueueEvent(id, userId, 'rejected', reason)
  return { success: true }
}

export async function requestEdits(
  id: string,
  userId: string,
  notes: string
): Promise<ActionResult> {
  const result = await updateQueueItem(
    id,
    userId,
    {
      status: 'needs_edits' as ReviewStatus,
      approved_at: null,
      rejected_at: null,
      rejection_reason: null,
      review_notes: notes,
    },
    { allowedFrom: EDITABLE_STATUSES, transitionName: 'request_edits' }
  )

  if (!result.success) return result
  await logQueueEvent(id, userId, 'needs_edits', notes)
  return { success: true }
}

export async function updateReviewNotes(
  id: string,
  userId: string,
  notes: string
): Promise<ActionResult> {
  const result = await updateQueueItem(
    id,
    userId,
    { review_notes: notes },
    { allowedFrom: EDITABLE_STATUSES, transitionName: 'update_notes' }
  )

  if (!result.success) return result
  await logQueueEvent(id, userId, 'notes_updated', notes)
  return { success: true }
}

export async function saveEdits(
  id: string,
  userId: string,
  edits: ReviewEdits
): Promise<ActionResult> {
  const result = await updateQueueItem(
    id,
    userId,
    { review_edits: edits },
    { allowedFrom: EDITABLE_STATUSES, transitionName: 'save_edits' }
  )

  if (!result.success) return result
  await logQueueEvent(id, userId, 'edits_saved', JSON.stringify(Object.keys(edits)))
  return { success: true }
}

export async function markReadyToPublish(id: string, userId: string): Promise<ActionResult> {
  const result = await updateQueueItem(
    id,
    userId,
    {
      status: 'ready_to_publish' as ReviewStatus,
      rejected_at: null,
      rejection_reason: null,
    },
    // Allow from both video_ready (normal path) and approved (if skipping video)
    { allowedFrom: ['video_ready', 'approved'], transitionName: 'mark_ready_to_publish' }
  )

  if (!result.success) return result
  await logQueueEvent(id, userId, 'ready_to_publish')
  return { success: true }
}

// Called by /api/queue/[id] PATCH when action=request_video_render.
// Sets status to video_rendering before the render API fires.
// The actual render is triggered via POST /api/render - this just validates the transition.
export async function markVideoRendering(id: string, userId: string): Promise<ActionResult> {
  const result = await updateQueueItem(
    id,
    userId,
    {
      status: 'video_rendering' as ReviewStatus,
      video_url: null,
    },
    { allowedFrom: ['approved', 'video_ready'], transitionName: 'request_video_render' }
  )

  if (!result.success) return result
  await logQueueEvent(id, userId, 'video_rendering')
  return { success: true }
}

// Called by webhook handler when render completes successfully.
export async function markVideoReady(
  id: string,
  userId: string,
  videoUrl: string
): Promise<ActionResult> {
  const result = await updateQueueItem(
    id,
    userId,
    {
      status: 'video_ready' as ReviewStatus,
      video_url: videoUrl,
    },
    { allowedFrom: ['video_rendering'], transitionName: 'mark_video_ready' }
  )

  if (!result.success) return result
  await logQueueEvent(id, userId, 'video_ready')
  return { success: true }
}

// Delete
export async function deleteQueueItem(id: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient()
  // NOTE: no audit log here - the row is being deleted so the FK would fail anyway.
  // content_queue_events rows are cleaned up by the cascade on the FK.
  const { data, error } = await supabase
    .from('content_queue')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) return { success: false, error: error.message, statusCode: 500 }
  if (!data) return { success: false, error: 'Item not found or not permitted to delete', statusCode: 404 }

  return { success: true, deletedCount: 1, deletedIds: [data.id] }
}

export async function bulkDeleteQueueItems(ids: string[], userId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_queue')
    .delete()
    .in('id', ids)
    .eq('user_id', userId)
    .select('id')

  if (error) return { success: false, error: error.message, statusCode: 500 }

  const deletedIds = (data ?? []).map(row => row.id)
  if (deletedIds.length === 0) {
    return { success: false, error: 'No items were deleted (not found or not permitted)', statusCode: 404 }
  }

  return { success: true, deletedCount: deletedIds.length, deletedIds }
}

export async function getQueueItems(
  userId: string,
  statusFilter?: ReviewStatus
): Promise<ContentQueueRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('content_queue')
    .select(
      'id, job_id, user_id, series_id, platform, status, title, hook, review_notes, review_edits, video_url, published_at, published_url, approved_at, rejected_at, rejection_reason, generated_at, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as ContentQueueRow[]
}

export async function getQueueItem(
  id: string,
  userId: string
): Promise<ContentQueueItemFull | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_queue')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch queue item: ${error.message}`)
  }

  return data as ContentQueueItemFull
}

async function logQueueEvent(
  queueItemId: string,
  userId: string,
  event: string,
  notes?: string
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('content_queue_events').insert({
    queue_item_id: queueItemId,
    user_id: userId,
    event,
    notes: notes ?? null,
  })
  if (error) {
    console.error(`[reviewQueue] audit log failed for "${event}" on ${queueItemId}:`, error.message)
  }
}


