// ─────────────────────────────────────────────────────────────────────────────
// Review Queue Service
//
// All human review actions live here. These are the ONLY functions that
// change status or edits on a content_queue row.
// No status change ever happens automatically.
//
// Key rule: `package` (the immutable AI output) is NEVER touched here.
// Human overrides go into `review_edits` (separate JSONB column).
// The UI merges package fields + review_edits to display the effective values.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { ReviewStatus, ReviewEdits } from '@/types/agents'
import { ContentQueueRow, ContentQueueItemFull } from '@/types/content'

type ActionResult = { success: boolean; error?: string }

// ── Approve ───────────────────────────────────────────────────────────────────
export async function approveContent(
  id: string,
  userId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('content_queue')
    .update({ status: 'approved' as ReviewStatus, approved_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  await logQueueEvent(id, userId, 'approved')
  return { success: true }
}

// ── Reject ────────────────────────────────────────────────────────────────────
export async function rejectContent(
  id: string,
  userId: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('content_queue')
    .update({
      status: 'rejected' as ReviewStatus,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', id).eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  await logQueueEvent(id, userId, 'rejected', reason)
  return { success: true }
}

// ── Request Edits ─────────────────────────────────────────────────────────────
export async function requestEdits(
  id: string,
  userId: string,
  notes: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('content_queue')
    .update({ status: 'needs_edits' as ReviewStatus, review_notes: notes })
    .eq('id', id).eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  await logQueueEvent(id, userId, 'needs_edits', notes)
  return { success: true }
}

// ── Update Notes ──────────────────────────────────────────────────────────────
export async function updateReviewNotes(
  id: string,
  userId: string,
  notes: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('content_queue')
    .update({ review_notes: notes })
    .eq('id', id).eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  await logQueueEvent(id, userId, 'notes_updated', notes)
  return { success: true }
}

// ── Save Edits ────────────────────────────────────────────────────────────────
// Writes human overrides to review_edits JSONB.
// NEVER touches the `package` column — the original AI output is immutable.
export async function saveEdits(
  id: string,
  userId: string,
  edits: ReviewEdits
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('content_queue')
    .update({ review_edits: edits })
    .eq('id', id).eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  await logQueueEvent(id, userId, 'edits_saved', JSON.stringify(Object.keys(edits)))
  return { success: true }
}

// ── Mark Ready to Publish ─────────────────────────────────────────────────────
// Human explicitly marks an approved item as ready for manual publishing.
// Does NOT trigger any publishing — that requires a separate human action.
export async function markReadyToPublish(
  id: string,
  userId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('content_queue')
    .update({ status: 'ready_to_publish' as ReviewStatus })
    .eq('id', id).eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  await logQueueEvent(id, userId, 'ready_to_publish')
  return { success: true }
}

// ── Fetch Queue List ──────────────────────────────────────────────────────────
export async function getQueueItems(
  userId: string,
  statusFilter?: ReviewStatus
): Promise<ContentQueueRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('content_queue')
    .select(
      'id, job_id, user_id, series_id, platform, status, title, hook, review_notes, review_edits, approved_at, rejected_at, rejection_reason, generated_at, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as ContentQueueRow[]
}

// ── Fetch Single Full Item ────────────────────────────────────────────────────
// Returns null for genuine "not found", throws for real DB errors
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

// ── Internal: Append-only audit log ──────────────────────────────────────────
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
