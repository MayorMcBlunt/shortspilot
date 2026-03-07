// ─────────────────────────────────────────────────────────────────────────────
// OpenAI client
// Uses the real GPT-4o API when OPENAI_API_KEY is set in .env.local.
// Falls back to a hardcoded stub ONLY if no key is present (safe for CI/testing).
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o'

export async function callAI(
  prompt: string,
  agentName: string,
  maxTokens = 1500
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  // ── Real API path ─────────────────────────────────────────────────────────
  if (apiKey) {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },  // enforces clean JSON output
        temperature: 0.8,  // enough creativity for varied content per series
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`OpenAI API error (${response.status}) for ${agentName}: ${errorBody}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error(`OpenAI returned empty content for ${agentName}`)
    }

    return content
  }

  // ── Stub fallback (no API key) ────────────────────────────────────────────
  // Only reached when OPENAI_API_KEY is not set.
  console.warn(`[callAI STUB] No OPENAI_API_KEY set — returning placeholder for ${agentName}`)

  switch (agentName) {
    case 'StrategyAgent':
      return JSON.stringify({
        theme: 'Stub theme — add OPENAI_API_KEY to .env.local for real content',
        angle: 'Stub angle',
        hooks: ['Stub hook 1', 'Stub hook 2', 'Stub hook 3'],
        targetEmotion: 'curiosity',
        talkingPoints: ['Stub point 1', 'Stub point 2', 'Stub point 3'],
        positioning: 'Stub positioning',
      })

    case 'ScriptAgent':
      return JSON.stringify({
        hook: 'Stub hook — add OPENAI_API_KEY for real scripts.',
        body: 'Stub body content.',
        cta: 'Stub CTA.',
        fullScript: 'Stub hook — add OPENAI_API_KEY for real scripts. Stub body content. Stub CTA.',
        estimatedDurationSeconds: 30,
        wordCount: 0,
      })

    case 'MediaAgent':
      return JSON.stringify({
        scenes: [
          {
            sceneNumber: 1,
            scriptSegment: 'Stub hook',
            visualDescription: 'Stub visual',
            cameraDirection: 'Close-up',
            editingNote: 'Cut on beat',
            assetGuidance: 'nature landscape',
          },
        ],
        overallStyle: 'Stub style',
        colorGrading: 'Neutral',
        musicMood: 'Upbeat',
        textOverlays: ['Stub overlay'],
        thumbnailConcept: 'Stub thumbnail',
      })

    case 'CaptionAgent':
      return JSON.stringify({
        primaryCaption: 'Stub caption — add OPENAI_API_KEY for real captions.',
        alternativeCaptions: ['Stub alt 1', 'Stub alt 2'],
        hashtags: ['#stub', '#addapikey'],
        title: 'Stub Title — Add OPENAI_API_KEY',
        ctaVariations: ['Stub CTA 1', 'Stub CTA 2'],
        platformNotes: 'Stub notes',
      })

    default:
      throw new Error(`[callAI] Unknown agentName: "${agentName}"`)
  }
}
