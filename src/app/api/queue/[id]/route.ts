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
} from '@/lib/jobs/reviewQueue'
import { isValidReviewAction, validateReviewEdits } from '@/lib/validation'

type Params = { params: { id: string } }

// GET /api/queue/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const item = await getQueueItem(params.id, user.id)
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
export async function PATCH(request: NextRequest, { params }: Params) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  let body: { action?: unknown; reason?: unknown; notes?: unknown; edits?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, reason, notes, edits } = body

  if (!isValidReviewAction(action)) {
    return NextResponse.json(
      { error: 'action must be one of: approve, reject, request_edits, update_notes, save_edits, mark_ready_to_publish' },
      { status: 400 }
    )
  }

  const reasonStr = typeof reason === 'string' ? reason.trim() : undefined
  const notesStr = typeof notes === 'string' ? notes.trim() : undefined

  let result: { success: boolean; error?: string }

  switch (action) {
    case 'approve':
      result = await approveContent(params.id, user.id)
      break

    case 'reject':
      if (!reasonStr) return NextResponse.json({ error: 'reason is required' }, { status: 400 })
      result = await rejectContent(params.id, user.id, reasonStr)
      break

    case 'request_edits':
      if (!notesStr) return NextResponse.json({ error: 'notes are required' }, { status: 400 })
      result = await requestEdits(params.id, user.id, notesStr)
      break

    case 'update_notes':
      if (!notesStr) return NextResponse.json({ error: 'notes are required' }, { status: 400 })
      result = await updateReviewNotes(params.id, user.id, notesStr)
      break

    case 'save_edits':
      if (!edits || !validateReviewEdits(edits)) {
        return NextResponse.json({ error: 'edits must be a valid ReviewEdits object' }, { status: 400 })
      }
      result = await saveEdits(params.id, user.id, edits)
      break

    case 'mark_ready_to_publish':
      result = await markReadyToPublish(params.id, user.id)
      break

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
