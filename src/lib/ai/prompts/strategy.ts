import { Series } from '@/types/series'
import { Platform } from '@/types/platform'
import { effectiveDurationRange } from '@/types/series'

export function buildStrategyPrompt(series: Series, platform: Platform): string {
  const { min: minSeconds, max: maxSeconds } = effectiveDurationRange(series)
  const pacing = series.pacing_style ?? 'medium'

  return `You are a short-form content strategist specialising in viral ${platform} content.

SERIES CONTEXT:
- Name: ${series.name}
- Niche: ${series.niche}
- Tone: ${series.tone}
- Target duration: ${minSeconds}–${maxSeconds} seconds
- Pacing style: ${pacing}
- Platform: ${platform}

Your job is to generate a content strategy for ONE video in this series.
The duration range is ${minSeconds}–${maxSeconds}s — calibrate the number of talking points accordingly.
${pacing === 'fast' ? 'With fast pacing, prefer 3–4 tight talking points over deeper coverage.' : ''}
${pacing === 'slow' ? 'With slow pacing, prefer 2–3 well-developed talking points with full sentences.' : ''}

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
