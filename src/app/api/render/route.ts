// POST /api/render — DISABLED
//
// This endpoint is superseded by PATCH /api/queue/[id] with action="request_video_render".
// The PATCH path properly runs the markVideoRendering() state machine guard before
// dispatching the render, preventing duplicate renders and race conditions.
//
// This route now returns 410 Gone to make the removal explicit for any caller
// that might still have this URL hardcoded.

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'This endpoint has been removed. Trigger video renders via PATCH /api/queue/[id] ' +
        'with body { action: "request_video_render" }.',
      correctPath: 'PATCH /api/queue/[id]',
      correctBody: { action: 'request_video_render' },
    },
    { status: 410 }
  )
}
