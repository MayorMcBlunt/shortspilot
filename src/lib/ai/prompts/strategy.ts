import { Series } from '@/types/series'
import { Platform } from '@/types/platform'

export function buildStrategyPrompt(series: Series, platform: Platform): string {
  return `You are a short-form content strategist specialising in viral ${platform} content.

SERIES CONTEXT:
- Name: ${series.name}
- Niche: ${series.niche}
- Tone: ${series.tone}
- Video length: ${series.length_seconds} seconds
- Platform: ${platform}

Your job is to generate a content strategy for ONE video in this series.

Return ONLY valid JSON matching this exact structure — no markdown, no extra text:
{
  "theme": "specific topic or subject of this video",
  "angle": "the unique perspective or contrarian take that makes this video stand out",
  "hooks": ["hook option 1", "hook option 2", "hook option 3"],
  "targetEmotion": "the primary emotion this video should trigger in the viewer",
  "talkingPoints": ["point 1", "point 2", "point 3"],
  "positioning": "one sentence on how this video is differentiated from others in this niche"
}`
}
