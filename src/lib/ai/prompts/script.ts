import { Series } from '@/types/series'
import { StrategyOutput } from '@/types/agents'
import { effectiveDurationRange } from '@/types/series'

// OpenAI TTS 'alloy' voice at normal speed — ~2.8 words/second.
// Must stay in sync with estimateDuration() in openaiTts.ts.
export const TTS_WORDS_PER_SECOND = 2.8

// ── Template slot constraint ───────────────────────────────────────────────────
// The Creatomate template has exactly 4 composition slots (Background-1..4).
// Scripts MUST produce exactly this many scenes — no more, no less.
// Scene breakdown: 1 hook + N segments + 1 ending = 4 total → N = 2 segments.
export const TEMPLATE_SCENE_COUNT = 4
export const TEMPLATE_SEGMENT_COUNT = TEMPLATE_SCENE_COUNT - 2 // subtract hook + ending

// Per-segment word ranges by pacing style.
// These are tuned so 2 segments + hook + ending fit within the 4-slot template.
const PACING_CONFIG = {
  fast:   { segmentMin: 5,  segmentMax: 9  },
  medium: { segmentMin: 7,  segmentMax: 12 },
  slow:   { segmentMin: 9,  segmentMax: 15 },
} as const

export function buildScriptPrompt(series: Series, strategy: StrategyOutput): string {
  const { min: minSeconds, max: maxSeconds } = effectiveDurationRange(series)
  const pacing = series.pacing_style ?? 'medium'
  const cfg = PACING_CONFIG[pacing]

  // Target word counts derived from the duration range
  const minWords = Math.round(minSeconds * TTS_WORDS_PER_SECOND)
  const maxWords = Math.round(maxSeconds * TTS_WORDS_PER_SECOND)

  const pacingInstruction =
    pacing === 'fast'
      ? 'Favour short, punchy fragments. Maximum impact per word. Cut anything that does not hit hard.'
      : pacing === 'slow'
      ? 'Write fuller sentences. Allow ideas to breathe. Each segment should develop one thought completely.'
      : 'Balance punchiness with substance. Each segment should be self-contained but quick to read.'

  return `You are a viral short-form video scriptwriter specialising in punchy, fact-driven content.

SERIES CONTEXT:
- Niche: ${series.niche}
- Tone: ${series.tone}
- Pacing style: ${pacing}

STRATEGY:
- Theme: ${strategy.theme}
- Angle: ${strategy.angle}
- Target emotion: ${strategy.targetEmotion}
- Hook suggestion: ${strategy.hooks[0]}
- Talking points: ${strategy.talkingPoints.join(', ')}

TIMING REQUIREMENT:
The script will be read by a TTS voice at ~${TTS_WORDS_PER_SECOND} words/second.
Total word count (hook + both segments + ending) must be between ${minWords} and ${maxWords} words.
This produces a video of ${minSeconds}–${maxSeconds} seconds naturally.

CRITICAL STRUCTURE REQUIREMENT:
The video template has exactly 4 visual slots: HOOK, SEGMENT 1, SEGMENT 2, ENDING.
You MUST write exactly 2 segments — no more, no fewer.
Writing 3 or more segments will cause black gaps in the final video.

PACING INSTRUCTION (${pacing}):
${pacingInstruction}

OUTPUT FORMAT:

HOOK (1 line, ${cfg.segmentMin}–${cfg.segmentMax} words)
- Grabs attention in the first 2–3 seconds
- Bold statement, surprising fact, or direct challenge

SEGMENT 1 (1 line, ${cfg.segmentMin}–${cfg.segmentMax} words)
- One self-contained punchy sentence
- Visually concrete — something that can be shown as stock footage

SEGMENT 2 (1 line, ${cfg.segmentMin}–${cfg.segmentMax} words)
- One self-contained punchy sentence
- A different visual idea from Segment 1

ENDING (1 line, 5–9 words)
- Short call to action or memorable punchline

EXAMPLE (finance niche, medium pacing, 20–28s):
{
  "hook": "Most people never learn this about compound interest.",
  "segments": [
    "Investing 100 dollars a month at 20 beats 1000 at 40.",
    "Time in the market always beats timing the market."
  ],
  "ending": "Follow for one money fact every day.",
  "fullScript": "Most people never learn this about compound interest. Investing 100 dollars a month at 20 beats 1000 at 40. Time in the market always beats timing the market. Follow for one money fact every day.",
  "estimatedDurationSeconds": 22,
  "wordCount": 0
}

Return ONLY valid JSON matching this exact structure — no markdown, no extra text:
{
  "hook": "your hook line here",
  "segments": ["segment 1 here", "segment 2 here"],
  "ending": "your ending line here",
  "fullScript": "hook + both segments + ending as one flowing spoken paragraph",
  "estimatedDurationSeconds": ${Math.round((minSeconds + maxSeconds) / 2)},
  "wordCount": 0
}`
}
