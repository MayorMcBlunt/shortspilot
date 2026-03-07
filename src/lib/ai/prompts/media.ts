import { Series } from '@/types/series'
import { StrategyOutput, ScriptOutput } from '@/types/agents'
import { Platform } from '@/types/platform'
import { TTS_WORDS_PER_SECOND } from '@/lib/ai/prompts/script'

export function buildMediaPrompt(
  series: Series,
  strategy: StrategyOutput,
  script: ScriptOutput,
  platform: Platform
): string {
  const visualStyle = series.visual_style ?? 'mixed'

  // Camera direction instruction based on visual style setting
  const cameraInstruction =
    visualStyle === 'b-roll'
      ? 'Use "B-roll" for ALL scenes including hook and ending. No talking head.'
      : visualStyle === 'talking-head'
      ? 'Use "talking head close-up" for ALL scenes. No B-roll.'
      : 'Use "talking head close-up" for hook and ending, "B-roll" for fact segments.'

  // Build numbered segment list — each segment maps to exactly one scene.
  // We also compute the expected clip duration so the media agent understands timing.
  const allSegments = [
    { label: 'HOOK',   text: script.hook },
    ...script.segments.map((s, i) => ({ label: `FACT ${i + 1}`, text: s })),
    { label: 'ENDING', text: script.ending },
  ]

  const segmentList = allSegments.map((seg, i) => {
    const words = seg.text.trim().split(/\s+/).length
    const clipSeconds = (words / TTS_WORDS_PER_SECOND).toFixed(1)
    return `${i + 1}. [${seg.label}] "${seg.text}" (~${clipSeconds}s clip)`
  }).join('\n')

  return `You are a short-form video director and editor.

SERIES CONTEXT:
- Niche: ${series.niche}
- Tone: ${series.tone}
- Platform: ${platform} (9:16 vertical format)
- Visual style: ${visualStyle}

STRUCTURED SCRIPT — ${allSegments.length} scenes required:
${segmentList}

CONTENT THEME: ${strategy.theme}
VISUAL STYLE GOAL: Match the tone "${series.tone}" and emotion "${strategy.targetEmotion}"

CAMERA DIRECTION RULE: ${cameraInstruction}

Each scene maps to exactly one segment above.
The clip duration shown (~Xs) is how long that clip will play — choose footage long enough.
The scriptSegment for each scene MUST be the exact text shown above.

Rules:
- Scene count must equal ${allSegments.length} (one per segment)
- assetGuidance: 2–4 concrete stock footage keywords (e.g. "black hole space timelapse")
- Choose footage that is at least as long as the clip duration shown

Return ONLY valid JSON matching this exact structure — no markdown, no extra text:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptSegment": "exact segment text",
      "visualDescription": "what the viewer sees",
      "cameraDirection": "B-roll or talking head close-up",
      "editingNote": "e.g. cut on beat, zoom in, text overlay",
      "assetGuidance": "2–4 keyword search string for stock footage"
    }
  ],
  "overallStyle": "describe the overall visual style in one sentence",
  "colorGrading": "color grading recommendation",
  "musicMood": "music mood and tempo recommendation",
  "textOverlays": ["key phrase 1", "key phrase 2"],
  "thumbnailConcept": "describe the ideal thumbnail for this video"
}`
}
