import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // TODO: handle incoming webhooks (e.g. video generation complete)
  return NextResponse.json({ message: 'Webhook received' })
}
