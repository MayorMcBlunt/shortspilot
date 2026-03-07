const PEXELS_API_KEY = process.env.PEXELS_API_KEY!
const PEXELS_BASE_URL = 'https://api.pexels.com/videos'

export type PexelsVideo = {
  id: number
  url: string
  duration: number
  width: number
  height: number
  downloadUrl: string    // MP4 — only valid for video-type Creatomate slots (3, 4)
  thumbnailUrl: string   // JPEG still — used for image-type Creatomate slots (1, 2)
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

// ── Stop words ────────────────────────────────────────────────────────────────
// Used only for extracting fallback noun tokens from scene text.
// NOT used on assetGuidance — the media agent already wrote clean keywords.
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'did', 'do',
  'for', 'from', 'had', 'has', 'have', 'how', 'i', 'in', 'is', 'it',
  'its', 'like', 'may', 'most', 'never', 'not', 'of', 'on', 'or',
  'our', 'that', 'the', 'them', 'they', 'this', 'to', 'was', 'we',
  'who', 'will', 'with', 'you', 'your',
  // meta/noise words that appear in assetGuidance but shouldn't be queries
  'stock', 'footage', 'video', 'scene', 'clip', 'clips', 'camera',
  'motion', 'graphic', 'graphics', 'creator', 'close', 'shot',
])

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

// ── Query construction ────────────────────────────────────────────────────────
// Strategy: use assetGuidance (already a clean 2–4 keyword phrase written by
// the media agent specifically for stock search) as the primary query.
// Only fall back to scene noun extraction if guidance is empty or too short.
//
// PREVIOUS APPROACH: merged guidance + sceneText + theme tokens (up to 24 tokens,
// sliced to 8) producing incoherent queries like "black holes spaghetti scientist
// space follow facts" → Pexels returned irrelevant results.
//
// NEW APPROACH: primary = guidance as-is (3–5 words), fallback = top 3 nouns
// from scene text. Theme is NOT included at query time (too broad, adds noise).
function buildSceneQueries(rawGuidance: string, context?: SceneClipContext): string[] {
  // Clean the guidance: strip common preamble patterns the media agent sometimes adds
  const guidance = rawGuidance
    .replace(/^(b-roll\s*[:\-]|stock footage\s*[:\-]|talking head\s*[:\-]|visual\s*[:\-])/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const guidanceTokens = tokenize(guidance)

  // Primary: use guidance directly — it's the most specific signal
  const primary = guidanceTokens.slice(0, 5).join(' ')

  // Fallback 1: top 3 nouns from the segment text (concrete subjects only)
  const sceneNouns = tokenize(context?.sceneText ?? '').slice(0, 3).join(' ')

  // Fallback 2: just the first 2 guidance tokens (broadest match)
  const broad = guidanceTokens.slice(0, 2).join(' ')

  const queries = [primary, sceneNouns, broad]
    .map((q) => q.trim())
    .filter((q) => q.length > 1)
    .map((q) => q.slice(0, 60)) // Pexels query length cap

  // Deduplicate — identical queries waste API rate limit
  return [...new Set(queries)]
}

// ── File picker ───────────────────────────────────────────────────────────────
// Prefer portrait HD. Falls back to any portrait, then any file.
function pickBestFile(video: PexelsVideoHit): PexelsVideoFile | null {
  return (
    video.video_files.find((f) => f.quality === 'hd' && f.height && f.width && f.height > f.width) ??
    video.video_files.find((f) => f.height && f.width && f.height > f.width) ??
    video.video_files.find((f) => f.quality === 'hd') ??
    video.video_files[0] ??
    null
  )
}

// ── Video scorer ──────────────────────────────────────────────────────────────
// Trust Pexels' own relevance ranking — their search engine already handles
// semantic matching far better than URL token matching.
//
// We only score on properties we can actually evaluate:
//   +4  portrait orientation   (vertical format is required)
//   +2  HD quality             (visual quality)
//   +3  duration within range  (clip is long enough to cover the segment)
//   -2  duration too short     (would need looping, which Creatomate may not do)
//
// REMOVED: URL token matching. Pexels video URLs are numeric IDs — they carry
// zero semantic information. Scoring on URL tokens was selecting irrelevant
// "portrait HD within duration range" clips over relevant landscape clips.
function scoreVideo(
  video: PexelsVideoHit,
  file: PexelsVideoFile,
  minDur: number,
  maxDur: number
): number {
  const isPortrait = Boolean(file.height && file.width && file.height > file.width)
  const isHd = file.quality === 'hd'

  let score = 0
  if (isPortrait) score += 4
  if (isHd) score += 2

  if (video.duration >= minDur) {
    score += 3 // long enough to cover the segment
    if (video.duration <= maxDur + 5) {
      score += 1 // bonus for not being excessively long
    }
  } else {
    score -= 2 // clip might be too short — penalise
  }

  return score
}

// ── Raw search ────────────────────────────────────────────────────────────────
async function searchRaw(query: string): Promise<PexelsVideoHit[]> {
  const params = new URLSearchParams({
    query,
    per_page: '15',      // fetch more candidates so scorer has better pool
    orientation: 'portrait',
    size: 'medium',
  })

  const response = await fetch(`${PEXELS_BASE_URL}/search?${params}`, {
    headers: { Authorization: PEXELS_API_KEY },
  })

  if (!response.ok) {
    console.error(`[pexels] search failed for "${query}": ${response.status} ${response.statusText}`)
    return []
  }

  const data = (await response.json()) as PexelsSearchResponse
  return data.videos ?? []
}

// ── Public: search for one clip ───────────────────────────────────────────────
export async function searchPexelsVideo(
  rawQuery: string,
  context?: SceneClipContext
): Promise<PexelsVideo | null> {
  const queries = buildSceneQueries(rawQuery, context)
  if (queries.length === 0) return null

  const minDur = context?.minDurationSeconds ?? 3
  const maxDur = context?.maxDurationSeconds ?? 20

  let best: { video: PexelsVideoHit; file: PexelsVideoFile; score: number } | null = null

  // Try each query in order; stop as soon as we have a good portrait result
  for (const query of queries) {
    const videos = await searchRaw(query)

    if (videos.length === 0) continue

    for (const video of videos) {
      const file = pickBestFile(video)
      if (!file) continue

      const score = scoreVideo(video, file, minDur, maxDur)
      if (!best || score > best.score) {
        best = { video, file, score }
      }
    }

    // If we found a portrait HD clip that's long enough, stop — no need for
    // the broader fallback queries which will return less relevant results.
    if (best && best.score >= 9) break

    await new Promise((resolve) => setTimeout(resolve, 80)) // rate limit spacing
  }

  if (!best) {
    console.warn(`[pexels] no usable clip for guidance "${rawQuery}"`)
    return null
  }

  console.log(
    `[pexels] selected clip ${best.video.id} (score=${best.score}, ` +
    `dur=${best.video.duration}s) for query "${queries[0]}"`
  )

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

// ── Public: fetch all scene clips ─────────────────────────────────────────────
// Falls back to the last successful clip when a search returns nothing,
// ensuring every slot always has a source.
export async function fetchSceneClips(
  assetGuidances: string[],
  contexts: SceneClipContext[] = []
): Promise<(PexelsVideo | null)[]> {
  const results: (PexelsVideo | null)[] = []
  let lastGoodClip: PexelsVideo | null = null

  for (let i = 0; i < assetGuidances.length; i++) {
    const clip = await searchPexelsVideo(assetGuidances[i], contexts[i])

    if (clip) {
      lastGoodClip = clip
      results.push(clip)
    } else {
      // Always push lastGoodClip (may be null if first scene also failed).
      // creatomate.ts handles null by using the FALLBACK_VIDEO_URL.
      console.warn(
        `[pexels] scene ${i + 1} failed — ` +
        (lastGoodClip ? `reusing clip ${lastGoodClip.id}` : 'no fallback available')
      )
      results.push(lastGoodClip)
    }

    // 100ms gap between requests to respect Pexels rate limit
    if (i < assetGuidances.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return results
}
