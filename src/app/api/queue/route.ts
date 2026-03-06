import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { getQueueItems } from '@/lib/jobs/reviewQueue'
import { ReviewStatus } from '@/types/agents'
import { isValidReviewStatus } from '@/lib/validation'

// GET /api/queue?status=pending_review
export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const rawStatus = new URL(request.url).searchParams.get('status')

  let statusFilter: ReviewStatus | undefined
  if (rawStatus !== null) {
    if (!isValidReviewStatus(rawStatus)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }
    statusFilter = rawStatus
  }

  try {
    const items = await getQueueItems(user.id, statusFilter)
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch queue' },
      { status: 500 }
    )
  }
}
