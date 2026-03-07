import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const forward = new URL('/api/publish/accounts/youtube/callback', url.origin)
  url.searchParams.forEach((value, key) => forward.searchParams.append(key, value))
  return NextResponse.redirect(forward)
}
