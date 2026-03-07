import { AgentResult, ScriptInput, ScriptOutput } from '@/types/agents'
import { buildScriptPrompt } from '@/lib/ai/prompts/script'
import { runAgent } from '@/lib/ai/runner'
import { validateScriptOutput } from '@/lib/validation'

const WORDS_PER_SECOND = 2.8

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function splitToTwoSegments(text: string): [string, string] {
  const cleaned = text.trim()
  if (!cleaned) return ['', '']

  const sentenceParts = splitSentences(cleaned)
  if (sentenceParts.length >= 2) {
    return [sentenceParts[0], sentenceParts.slice(1).join(' ')]
  }

  const tokens = words(cleaned)
  if (tokens.length < 2) return [cleaned, cleaned]
  const mid = Math.ceil(tokens.length / 2)
  return [tokens.slice(0, mid).join(' '), tokens.slice(mid).join(' ')]
}

function normalizeScriptLike(raw: unknown): ScriptOutput | null {
  if (typeof raw !== 'object' || raw === null) return null
  const d = raw as Record<string, unknown>

  const rawFullScript = typeof d.fullScript === 'string' ? d.fullScript.trim() : ''
  const rawBody = typeof d.body === 'string' ? d.body.trim() : ''

  let hook = typeof d.hook === 'string' ? d.hook.trim() : ''
  let ending =
    typeof d.ending === 'string'
      ? d.ending.trim()
      : typeof d.cta === 'string'
      ? d.cta.trim()
      : ''

  let segments: string[] = []
  if (Array.isArray(d.segments)) {
    segments = d.segments.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
  } else if (rawBody) {
    const [s1, s2] = splitToTwoSegments(rawBody)
    segments = [s1, s2].filter(Boolean)
  } else if (rawFullScript) {
    const [s1, s2] = splitToTwoSegments(rawFullScript)
    segments = [s1, s2].filter(Boolean)
  }

  if (segments.length === 1) {
    const [s1, s2] = splitToTwoSegments(segments[0])
    segments = [s1, s2].filter(Boolean)
  }
  if (segments.length >= 2) {
    segments = segments.slice(0, 2)
  }

  // Fallbacks when model drifts from strict schema but returns usable text.
  if (!hook) {
    const source = rawFullScript || rawBody || segments[0] || ''
    if (source) {
      const sentences = splitSentences(source)
      hook = sentences[0] ?? words(source).slice(0, 8).join(' ')
    }
  }

  if (!ending) {
    const source = rawFullScript || rawBody || segments[segments.length - 1] || ''
    if (source) {
      const sentences = splitSentences(source)
      ending = sentences[sentences.length - 1] ?? 'Follow for more.'
    }
  }

  const assembled = [hook, ...segments, ending].map((s) => s.trim()).filter(Boolean).join(' ')
  const wordCount = words(assembled).length

  // Always derive duration from assembled text to avoid bad model-provided estimates
  // causing false validation failures.
  const estimatedDurationSeconds = Math.max(1, Math.round(wordCount / WORDS_PER_SECOND))

  return {
    hook,
    segments,
    ending,
    fullScript: assembled,
    estimatedDurationSeconds,
    wordCount,
  }
}

export async function scriptAgent(
  input: ScriptInput
): Promise<AgentResult<ScriptOutput>> {
  const prompt = buildScriptPrompt(input.context.series, input.strategy)

  // Parse raw AI JSON first, then normalize to the current ScriptOutput shape.
  // This keeps generation resilient when the model returns legacy fields
  // (e.g. body/cta) during schema transitions.
  const result = await runAgent<unknown>('ScriptAgent', prompt)

  if (!result.success) {
    return result
  }

  const normalized = normalizeScriptLike(result.data)
  if (!normalized || !validateScriptOutput(normalized)) {
    return { success: false, error: 'ScriptAgent returned JSON with missing or invalid fields' }
  }

  return { success: true, data: normalized }
}
