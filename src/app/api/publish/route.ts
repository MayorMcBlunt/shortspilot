import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { getQueueItem } from '@/lib/jobs/reviewQueue'
import { executeYouTubePublish } from '@/lib/jobs/publishContent'

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  let body: {
    queueItemId?: unknown
    connectedAccountId?: unknown
    title?: unknown
    description?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const queueItemId = typeof body.queueItemId === 'string' ? body.queueItemId.trim() : ''
  const connectedAccountId = typeof body.connectedAccountId === 'string' ? body.connectedAccountId.trim() : undefined
  const title = typeof body.title === 'string' ? body.title.trim() : undefined
  const description = typeof body.description === 'string' ? body.description.trim() : undefined

  if (!queueItemId) {
    return NextResponse.json({ error: 'queueItemId is required' }, { status: 400 })
  }

  const item = await getQueueItem(queueItemId, user.id)
  if (!item) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
  }

  if (item.status !== 'ready_to_publish') {
    return NextResponse.json(
      { error: `Queue item must be ready_to_publish (current: ${item.status})` },
      { status: 409 }
    )
  }

  if (!item.video_url) {
    return NextResponse.json({ error: 'Queue item has no video_url to publish' }, { status: 409 })
  }

  if (item.platform !== 'youtube') {
    return NextResponse.json(
      { error: 'Phase 1 publishing supports YouTube items only' },
      { status: 409 }
    )
  }

  const result = await executeYouTubePublish({
    item,
    userId: user.id,
    connectedAccountId,
    title,
    description,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, publishJobId: result.publishJobId ?? null },
      { status: result.statusCode ?? 500 }
    )
  }

  return NextResponse.json({
    success: true,
    publishJobId: result.publishJobId,
    externalPostUrl: result.externalPostUrl,
  })
}
