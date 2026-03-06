import { Series } from '@/types/series'
import { StrategyOutput } from '@/types/agents'

export function buildScriptPrompt(series: Series, strategy: StrategyOutput): string {
  return `You are a viral short-form video scriptwriter.

SERIES CONTEXT:
- Niche: ${series.niche}
- Tone: ${series.tone}
- Target length: ${series.length_seconds} seconds (approx ${Math.round(series.length_seconds * 2.5)} words)

STRATEGY:
- Theme: ${strategy.theme}
- Angle: ${strategy.angle}
- Target emotion: ${strategy.targetEmotion}
- Chosen hook: ${strategy.hooks[0]}
- Talking points: ${strategy.talkingPoints.join(', ')}

Write a script for this video. Speak directly to camera. Keep sentences short and punchy.
The hook must grab attention in the first 3 seconds.
End with a natural call to action that fits the tone.

Return ONLY valid JSON matching this exact structure — no markdown, no extra text:
{
  "hook": "opening line — first 3 seconds",
  "body": "main content — the bulk of the script",
  "cta": "closing call to action",
  "fullScript": "hook + body + cta assembled as one flowing script",
  "estimatedDurationSeconds": ${series.length_seconds},
  "wordCount": 0
}`
}
