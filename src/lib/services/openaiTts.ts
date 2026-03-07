// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Text-to-Speech service
//
// Generates an MP3 voiceover from a script via OpenAI TTS.
// Returns the audio as a base64 data URL so it can be passed directly to
// Creatomate without requiring a Supabase Storage bucket to exist first.
//
// Storage upload is attempted as a bonus (for archiving) but never blocks
// the render pipeline if it fails.
// ─────────────────────────────────────────────────────────────────────────────

const TTS_VOICE = 'alloy' as const
const TTS_MODEL = 'tts-1' as const

export type TtsResult =
  | {
      success: true
      // Always set — base64 data URL usable directly by Creatomate
      audioDataUrl: string
      // Set if storage upload succeeded — used for long-term archiving only
      audioStorageUrl: string | null
      storagePath: string | null
      durationEstimateSeconds: number
    }
  | { success: false; error: string }

export async function generateVoiceover(script: string, jobId: string): Promise<TtsResult> {
  const openaiKey = process.env.OPENAI_API_KEY

  // ── Stub: no API key ──────────────────────────────────────────────────────
  if (!openaiKey) {
    console.warn('[openaiTts] No OPENAI_API_KEY — using stub audio')
    return {
      success: true,
      audioDataUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      audioStorageUrl: null,
      storagePath: null,
      durationEstimateSeconds: estimateDuration(script),
    }
  }

  // ── Real TTS call ─────────────────────────────────────────────────────────
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: script,
        voice: TTS_VOICE,
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `OpenAI TTS failed (${response.status}): ${errorText}` }
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())
    // Convert to base64 data URL — works directly as a Creatomate audio source
    const audioDataUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`

    // ── Best-effort storage upload (non-blocking) ─────────────────────────
    // If the bucket doesn't exist yet this will fail silently — render still proceeds.
    let audioStorageUrl: string | null = null
    let storagePath: string | null = null

    try {
      const { uploadToStorage } = await import('@/lib/services/storage')
      const storagePath_ = `audio/${jobId}.mp3`
      const uploadResult = await uploadToStorage(audioBuffer, storagePath_, 'audio/mpeg')
      if (uploadResult.success) {
        audioStorageUrl = uploadResult.url
        storagePath = storagePath_
      } else {
        console.warn(`[openaiTts] Storage upload skipped (bucket may not exist yet): ${uploadResult.error}`)
      }
    } catch (storageErr) {
      console.warn('[openaiTts] Storage upload threw — continuing without it:', storageErr)
    }

    return {
      success: true,
      audioDataUrl,
      audioStorageUrl,
      storagePath,
      durationEstimateSeconds: estimateDuration(script),
    }
  } catch (err) {
    return {
      success: false,
      error: `TTS error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

function estimateDuration(script: string): number {
  const wordCount = script.trim().split(/\s+/).length
  return Math.ceil(wordCount / 2.5)
}
