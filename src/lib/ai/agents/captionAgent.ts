import { AgentResult, CaptionInput, CaptionOutput } from '@/types/agents'
import { buildCaptionPrompt } from '@/lib/ai/prompts/caption'
import { runAgent } from '@/lib/ai/runner'
import { validateCaptionOutput } from '@/lib/validation'

export async function captionAgent(
  input: CaptionInput
): Promise<AgentResult<CaptionOutput>> {
  const prompt = buildCaptionPrompt(
    input.context.series,
    input.strategy,
    input.script,
    input.context.platform
  )
  return runAgent<CaptionOutput>('CaptionAgent', prompt, validateCaptionOutput)
}
