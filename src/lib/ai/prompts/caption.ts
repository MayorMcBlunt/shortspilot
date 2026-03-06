import { Series } from '@/types/series'
import { StrategyOutput, ScriptOutput } from '@/types/agents'
import { Platform, PLATFORM_CONFIGS } from '@/types/platform'

export function buildCaptionPrompt(
  series: Series,
  strategy: StrategyOutput,
  script: ScriptOutput,
  platform: Platform
): string {
  const config = PLATFORM_CONFIGS[platform]

  return `You are a social media copywriter specialising in ${platform} content.

SERIES CONTEXT:
- Niche: ${series.niche}
- Tone: ${series.tone}
- Platform: ${platform}
- Caption character limit: ${config.captionLimit}
- Max hashtags: ${config.hashtagLimit}

VIDEO HOOK: ${script.hook}
VIDEO THEME: ${strategy.theme}
TARGET EMOTION: ${strategy.targetEmotion}

Write captions and metadata for this video.
- Primary caption should be punchy and stop the scroll
- Hashtags should be a mix of niche, broad, and trending tags
- Title should be optimised for ${platform} search
- CTA variations should feel natural, not forced

Return ONLY valid JSON matching this exact structure — no markdown, no extra text:
{
  "primaryCaption": "main caption for posting",
  "alternativeCaptions": ["alternative 1", "alternative 2"],
  "hashtags": ["#tag1", "#tag2"],
  "title": "video title optimised for ${platform}",
  "ctaVariations": ["cta option 1", "cta option 2", "cta option 3"],
  "platformNotes": "any specific tips for this platform"
}`
}
