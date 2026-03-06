// OpenAI client
// Install: npm install openai  (already in package.json)
// Add OPENAI_API_KEY to your .env.local

// ─── Uncomment this block once you are ready to go live ──────────────────────
// import OpenAI from 'openai'
//
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// })
//
// export async function callAI(
//   prompt: string,
//   agentName: string,
//   maxTokens = 1000
// ): Promise<string> {
//   const response = await openai.chat.completions.create({
//     model: 'gpt-4o',
//     messages: [{ role: 'user', content: prompt }],
//     max_tokens: maxTokens,
//     response_format: { type: 'json_object' }, // enforces JSON output
//   })
//   const content = response.choices[0].message.content
//   if (!content) throw new Error(`OpenAI returned empty response for ${agentName}`)
//   return content
// }
// ─────────────────────────────────────────────────────────────────────────────

// ── Stub — returns realistic placeholder JSON per agent ───────────────────────
// agentName is passed explicitly by runAgent() — no fragile keyword scanning.

export async function callAI(
  prompt: string,
  agentName: string,
  _maxTokens = 1000
): Promise<string> {
  console.log(`[callAI STUB] ${agentName} — prompt length: ${prompt.length} chars`)

  switch (agentName) {
    case 'StrategyAgent':
      return JSON.stringify({
        theme: 'Morning productivity routines that actually work',
        angle: 'Most people focus on morning routines wrong — here is the contrarian approach',
        hooks: [
          'Your morning routine is why you are failing',
          'I wasted 3 years on the wrong morning routine',
          'The one thing productive people do differently in the morning',
        ],
        targetEmotion: 'curiosity',
        talkingPoints: [
          'The myth of the 5am wake-up',
          'Energy management vs time management',
          'The only 3 things that actually matter',
        ],
        positioning: 'Cuts through productivity influencer noise with a direct, evidence-based perspective',
      })

    case 'ScriptAgent':
      return JSON.stringify({
        hook: 'Your morning routine is why you are failing.',
        body: 'Most people optimise for how their morning looks — not how it feels. Here is what actually matters: energy, focus, and one clear priority. Everything else is noise.',
        cta: 'Follow for more no-fluff productivity content.',
        fullScript: 'Your morning routine is why you are failing. Most people optimise for how their morning looks — not how it feels. Here is what actually matters: energy, focus, and one clear priority. Everything else is noise. Follow for more no-fluff productivity content.',
        estimatedDurationSeconds: 45,
        wordCount: 0, // recalculated in scriptAgent post-process
      })

    case 'MediaAgent':
      return JSON.stringify({
        scenes: [
          {
            sceneNumber: 1,
            scriptSegment: 'Your morning routine is why you are failing.',
            visualDescription: 'Creator stares directly into camera — serious expression',
            cameraDirection: 'Tight close-up, eye level',
            editingNote: 'Hold 1.5s then quick cut',
            assetGuidance: 'Creator on camera',
          },
          {
            sceneNumber: 2,
            scriptSegment: 'Most people optimise for how their morning looks — not how it feels.',
            visualDescription: 'B-roll of someone hitting snooze, scrolling phone in bed',
            cameraDirection: 'B-roll overhead shot',
            editingNote: 'Slow zoom, muted colour grade',
            assetGuidance: 'Stock footage: person in bed morning alarm',
          },
          {
            sceneNumber: 3,
            scriptSegment: 'Here is what actually matters: energy, focus, and one clear priority.',
            visualDescription: 'Text overlays appear one by one on dark background',
            cameraDirection: 'Motion graphic / text on screen',
            editingNote: 'Text pops in on each word with subtle sound design',
            assetGuidance: 'Motion graphic — no footage needed',
          },
        ],
        overallStyle: 'High contrast, minimal, direct — no fluff visuals',
        colorGrading: 'Desaturated with warm highlights',
        musicMood: 'Tense lo-fi, 90bpm, builds slightly',
        textOverlays: ['energy', 'focus', 'one priority'],
        thumbnailConcept: 'Creator pointing at camera with bold text: YOUR ROUTINE IS BROKEN',
      })

    case 'CaptionAgent':
      return JSON.stringify({
        primaryCaption: 'Your morning routine is lying to you. Here is what actually moves the needle 👇',
        alternativeCaptions: [
          'Stop optimising for Instagram morning routines. Do this instead.',
          'I tested every productivity routine. Here is the only thing that worked.',
        ],
        hashtags: ['#productivity', '#morningroutine', '#shorts', '#selfimprovement', '#focus', '#mindset'],
        title: 'Your Morning Routine Is Why You Are Failing',
        ctaVariations: [
          'Follow for more no-fluff productivity',
          'Save this for tomorrow morning',
          'Comment your current wake-up time 👇',
        ],
        platformNotes: 'Post between 7–9am for maximum reach on this niche',
      })

    default:
      throw new Error(`[callAI STUB] Unknown agentName: "${agentName}"`)
  }
}
