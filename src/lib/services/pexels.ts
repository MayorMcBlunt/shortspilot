const PEXELS_API_KEY = process.env.PEXELS_API_KEY!
const PEXELS_BASE_URL = 'https://api.pexels.com/videos'

export type PexelsVideo = {
  id: number
  url: string
  duration: number
  width: number
  height: number
  downloadUrl: string
  thumbnailUrl: string
}

type PexelsVideoFile = {
  quality: string
  file_type: string
  width: number | null
  height: number | null
  link: string
}

type PexelsVideoHit = {
  id: number
  url: string
  duration: number
  width: number
  height: number
  image: string
  video_files: PexelsVideoFile[]
}

type PexelsSearchResponse = {
  videos: PexelsVideoHit[]
  total_results: number
}

export type SceneClipContext = {
  sceneText?: string
  theme?: string
  minDurationSeconds?: number
  maxDurationSeconds?: number
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'of', 'on',
  'or', 'that', 'the', 'this', 'to', 'with', 'you', 'your', 'we', 'our', 'their', 'they', 'them', 'short',
  'video', 'scene', 'footage', 'stock', 'creator', 'camera', 'motion', 'graphic', 'graphics', 'clip', 'clips',
])

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

function cleanGuidance(rawGuidance: string): string {
  return rawGuidance
    .replace(/^(stock footage:|creator on camera|motion graphic.*)/i, '')
    .replace(/[-:]/g, ' ')
    .trim()
}

function buildSceneQueries(rawGuidance: string, context?: SceneClipContext): string[] {
  const guidance = cleanGuidance(rawGuidance)
  const guidanceTokens = tokenize(guidance)
  const sceneTokens = tokenize(context?.sceneText ?? '')
  const themeTokens = tokenize(context?.theme ?? '')

  const primaryTokens = [...new Set([...guidanceTokens, ...sceneTokens, ...themeTokens])].slice(0, 8)
  const secondaryTokens = [...new Set([...guidanceTokens, ...sceneTokens])].slice(0, 8)
  const fallbackTokens = guidanceTokens.slice(0, 8)

  const queries = [
    primaryTokens.join(' '),
    secondaryTokens.join(' '),
    fallbackTokens.join(' '),
  ]

  return [...new Set(queries.map((q) => q.trim()).filter(Boolean).map((q) => q.slice(0, 80)))]
}

function pickBestFile(video: PexelsVideoHit): PexelsVideoFile | null {
  return (
    video.video_files.find((f) => f.quality === 'hd' && f.height && f.width && f.height > f.width) ??
    video.video_files.find((f) => f.height && f.width && f.height > f.width) ??
    video.video_files[0] ??
    null
  )
}

function scoreVideo(video: PexelsVideoHit, file: PexelsVideoFile, queryTokens: string[], minDur: number, maxDur: number): number {
  const isPortrait = Boolean(file.height && file.width && file.height > file.width)
  const isHd = file.quality === 'hd'

  let score = 0
  if (isPortrait) score += 3
  if (isHd) score += 1

  if (video.duration >= minDur && video.duration <= maxDur) {
    score += 2
  } else {
    score -= 1
  }

  const urlTokens = new Set(tokenize(video.url))
  let tokenMatches = 0
  for (const token of queryTokens) {
    if (urlTokens.has(token)) tokenMatches += 1
  }
  score += tokenMatches * 1.5

  return score
}

async function searchRaw(query: string): Promise<PexelsVideoHit[]> {
  const params = new URLSearchParams({
    query,
    per_page: '10',
    orientation: 'portrait',
    size: 'medium',
  })

  const response = await fetch(`${PEXELS_BASE_URL}/search?${params}`, {
    headers: { Authorization: PEXELS_API_KEY },
  })

  if (!response.ok) {
    console.error(`[pexels] search failed for "${query}": ${response.status}`)
    return []
  }

  const data = (await response.json()) as PexelsSearchResponse
  return data.videos ?? []
}

export async function searchPexelsVideo(rawQuery: string, context?: SceneClipContext): Promise<PexelsVideo | null> {
  const queries = buildSceneQueries(rawQuery, context)
  if (queries.length === 0) return null

  const minDur = context?.minDurationSeconds ?? 3
  const maxDur = context?.maxDurationSeconds ?? 15

  let best: { video: PexelsVideoHit; file: PexelsVideoFile; score: number } | null = null

  for (const query of queries.slice(0, 2)) {
    const queryTokens = tokenize(query)
    const videos = await searchRaw(query)

    if (videos.length === 0) {
      continue
    }

    for (const video of videos) {
      const file = pickBestFile(video)
      if (!file) continue

      const score = scoreVideo(video, file, queryTokens, minDur, maxDur)
      if (!best || score > best.score) {
        best = { video, file, score }
      }
    }
  }

  if (!best) {
    console.warn(`[pexels] no usable clip for guidance "${rawQuery}"`)
    return null
  }

  return {
    id: best.video.id,
    url: best.video.url,
    duration: best.video.duration,
    width: best.file.width ?? best.video.width,
    height: best.file.height ?? best.video.height,
    downloadUrl: best.file.link,
    thumbnailUrl: best.video.image,
  }
}

export async function fetchSceneClips(
  assetGuidances: string[],
  contexts: SceneClipContext[] = []
): Promise<(PexelsVideo | null)[]> {
  const results: (PexelsVideo | null)[] = []
  let lastGoodClip: PexelsVideo | null = null

  for (let i = 0; i < assetGuidances.length; i++) {
    const guidance = assetGuidances[i]
    const context = contexts[i]
    const clip = await searchPexelsVideo(guidance, context)

    if (clip) {
      lastGoodClip = clip
      results.push(clip)
    } else {
      // Safer fallback for continuity: reuse last known-good clip if available.
      results.push(lastGoodClip)
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return results
}
