// POST /api/render
// Triggers TTS + Pexels clip fetch + Creatomate render for an approved queue item.
//
// Body: { queueItemId: string }
// Auth: required (user must own the queue item)
// Status guard: item must be 'approved' to trigger a render

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { getQueueItem } from '@/lib/jobs/reviewQueue'
import { renderVideoForQueueItem } from '@/lib/jobs/renderVideo'

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  let body: { queueItemId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { queueItemId } = body

  if (!queueItemId || typeof queueItemId !== 'string' || queueItemId.trim() === '') {
    return NextResponse.json({ error: 'queueItemId is required' }, { status: 400 })
  }

  // Load the full item (includes ContentPackage JSONB)
  const item = await getQueueItem(queueItemId.trim(), user.id)
  if (!item) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
  }

  // Only allow render from 'approved' status
  if (item.status !== 'approved') {
    return NextResponse.json(
      {
        error: `Cannot render: item status is "${item.status}". Item must be "approved" first.`,
        currentStatus: item.status,
      },
      { status: 409 }
    )
  }

  const result = await renderVideoForQueueItem(item, user.id)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    videoJobId: result.videoJobId,
    externalJobId: result.externalJobId,
    message: result.externalJobId?.startsWith('stub-')
      ? 'Stub render complete — video available immediately'
      : 'Video render dispatched — check back shortly',
  })
}
