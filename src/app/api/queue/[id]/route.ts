import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import {
  getQueueItem,
  approveContent,
  rejectContent,
  requestEdits,
  updateReviewNotes,
  saveEdits,
  markReadyToPublish,
  markVideoRendering,
  deleteQueueItem,
} from '@/lib/jobs/reviewQueue'
import { renderVideoForQueueItem } from '@/lib/jobs/renderVideo'
import { isValidReviewAction, validateReviewEdits } from '@/lib/validation'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/queue/[id]
export async function GET(_req: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await context.params

  try {
    const item = await getQueueItem(id, user.id)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch item' },
      { status: 500 }
    )
  }
}

// PATCH /api/queue/[id]
// Body: { action, reason?, notes?, edits? }
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await context.params

  let body: { action?: unknown; reason?: unknown; notes?: unknown; edits?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, reason, notes, edits } = body

  if (!isValidReviewAction(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${['approve','reject','request_edits','update_notes','save_edits','mark_ready_to_publish','request_video_render'].join(', ')}` },
      { status: 400 }
    )
  }

  const reasonStr = typeof reason === 'string' ? reason.trim() : undefined
  const notesStr = typeof notes === 'string' ? notes.trim() : undefined

  let result: { success: boolean; error?: string; statusCode?: number }

  switch (action) {
    case 'approve':
      result = await approveContent(id, user.id)
      break

    case 'reject':
      if (!reasonStr) return NextResponse.json({ error: 'reason is required' }, { status: 400 })
      result = await rejectContent(id, user.id, reasonStr)
      break

    case 'request_edits':
      if (!notesStr) return NextResponse.json({ error: 'notes are required' }, { status: 400 })
      result = await requestEdits(id, user.id, notesStr)
      break

    case 'update_notes':
      if (!notesStr) return NextResponse.json({ error: 'notes are required' }, { status: 400 })
      result = await updateReviewNotes(id, user.id, notesStr)
      break

    case 'save_edits':
      if (!edits || !validateReviewEdits(edits)) {
        return NextResponse.json({ error: 'edits must be a valid ReviewEdits object' }, { status: 400 })
      }
      result = await saveEdits(id, user.id, edits)
      break

    case 'mark_ready_to_publish':
      result = await markReadyToPublish(id, user.id)
      break

    case 'request_video_render': {
      // First validate the status transition
      const transitionResult = await markVideoRendering(id, user.id)
      if (!transitionResult.success) {
        return NextResponse.json(
          { error: transitionResult.error },
          { status: transitionResult.statusCode ?? 500 }
        )
      }
      // Then fire the actual render (async â€” returns immediately in stub mode)
      const queueItem = await getQueueItem(id, user.id)
      if (!queueItem) {
        return NextResponse.json({ error: 'Queue item not found after status update' }, { status: 404 })
      }
      const renderResult = await renderVideoForQueueItem(queueItem, user.id)
      if (!renderResult.success) {
        // Roll back to approved if render dispatch fails
        return NextResponse.json({ error: renderResult.error }, { status: 500 })
      }
      return NextResponse.json({
        success: true,
        videoJobId: renderResult.videoJobId,
        message: renderResult.externalJobId?.startsWith('stub-')
          ? 'Stub render complete â€” video available immediately'
          : 'Video render dispatched',
      })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode ?? 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/queue/[id]
// Permanently deletes a queue item. No undo â€” testing/moderation use only.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const result = await deleteQueueItem(id, user.id)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode ?? 500 })
  }

  return NextResponse.json({ success: true, deleted: result.deletedCount ?? 0, deletedIds: result.deletedIds ?? [] })
}


