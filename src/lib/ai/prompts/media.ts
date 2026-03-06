import { Series } from '@/types/series'
import { StrategyOutput, ScriptOutput } from '@/types/agents'
import { Platform } from '@/types/platform'

export function buildMediaPrompt(
  series: Series,
  strategy: StrategyOutput,
  script: ScriptOutput,
  platform: Platform
): string {
  return `You are a short-form video director and editor.

SERIES CONTEXT:
- Niche: ${series.niche}
- Tone: ${series.tone}
- Platform: ${platform} (9:16 vertical format)
- Length: ${series.length_seconds} seconds

SCRIPT:
${script.fullScript}

CONTENT THEME: ${strategy.theme}
VISUAL STYLE GOAL: Match the tone "${series.tone}" and emotion "${strategy.targetEmotion}"

Create a scene-by-scene visual production plan for this script.
Break the script into 3–5 scenes. For each scene provide camera direction, editing notes and asset guidance.

Return ONLY valid JSON matching this exact structure — no markdown, no extra text:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptSegment": "exact words from script this scene covers",
      "visualDescription": "what the viewer sees",
      "cameraDirection": "e.g. close-up talking head, B-roll, screen recording",
      "editingNote": "e.g. cut on beat, add text overlay, zoom in",
      "assetGuidance": "e.g. stock footage keywords, or 'creator on camera'"
    }
  ],
  "overallStyle": "describe the overall visual style in one sentence",
  "colorGrading": "color grading recommendation",
  "musicMood": "music mood and tempo recommendation",
  "textOverlays": ["key phrase 1", "key phrase 2"],
  "thumbnailConcept": "describe the ideal thumbnail for this video"
}`
}
