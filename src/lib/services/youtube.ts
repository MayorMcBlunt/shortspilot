// YouTube Data API v3 integration
// Docs: https://developers.google.com/youtube/v3

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

export type YouTubePublishResult = {
  videoId: string
  videoUrl: string
  responsePayload?: Record<string, unknown>
}

export type YouTubeVideoStats = {
  videoId: string
  title: string
  publishedAt: string | null
  viewCount: number
  likeCount: number
  commentCount: number
}

export async function publishToYouTube(
  accessToken: string,
  videoUrl: string,
  title: string,
  description: string
): Promise<YouTubePublishResult> {
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    throw new Error(`Failed to fetch source video (${videoRes.status})`)
  }

  const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
  if (videoBuffer.length === 0) {
    throw new Error('Source video file is empty')
  }

  const boundary = `shortspilot-${Date.now().toString(36)}`
  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description,
      categoryId: '22',
    },
    status: {
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
    },
  }

  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: video/mp4\r\n\r\n',
    'utf8'
  )
  const suffix = Buffer.from(`\r\n--${boundary}--`, 'utf8')
  const body = Buffer.concat([prefix, videoBuffer, suffix])

  const uploadUrl = `${YOUTUBE_API_BASE.replace('/youtube/v3', '/upload/youtube/v3')}/videos?part=snippet,status&uploadType=multipart`

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube publish failed (${res.status}): ${text}`)
  }

  const json = (await res.json()) as { id?: string } & Record<string, unknown>
  if (!json.id) {
    throw new Error('YouTube publish succeeded but returned no video id')
  }

  return {
    videoId: json.id,
    videoUrl: `https://www.youtube.com/watch?v=${json.id}`,
    responsePayload: json,
  }
}

export async function fetchYouTubeVideoStats(
  accessToken: string,
  videoIds: string[]
): Promise<YouTubeVideoStats[]> {
  const uniqueIds = [...new Set(videoIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < uniqueIds.length; i += 50) {
    chunks.push(uniqueIds.slice(i, i + 50))
  }

  const all: YouTubeVideoStats[] = []

  for (const chunk of chunks) {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: chunk.join(','),
      maxResults: String(chunk.length),
    })

    const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to load YouTube analytics (${res.status}): ${text}`)
    }

    const json = (await res.json()) as {
      items?: Array<{
        id?: string
        snippet?: { title?: string; publishedAt?: string }
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }
      }>
    }

    const mapped = (json.items ?? [])
      .filter((item) => Boolean(item.id))
      .map((item) => ({
        videoId: item.id!,
        title: item.snippet?.title ?? 'Untitled video',
        publishedAt: item.snippet?.publishedAt ?? null,
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
      }))

    all.push(...mapped)
  }

  return all
}
