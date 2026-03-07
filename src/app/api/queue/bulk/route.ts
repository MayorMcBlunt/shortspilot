// DELETE /api/queue/bulk
// Deletes multiple queue items in one call.
// Body: { ids: string[] }

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { bulkDeleteQueueItems } from '@/lib/jobs/reviewQueue'

export async function DELETE(request: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  let body: { ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { ids } = body

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
    return NextResponse.json({ error: 'ids must be a non-empty array of strings' }, { status: 400 })
  }

  const result = await bulkDeleteQueueItems(ids as string[], user.id)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode ?? 500 })
  }

  return NextResponse.json({
    success: true,
    deleted: result.deletedCount ?? 0,
    deletedIds: result.deletedIds ?? [],
  })
}
