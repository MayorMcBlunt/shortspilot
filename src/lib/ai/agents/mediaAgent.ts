import { AgentResult, MediaInput, MediaOutput } from '@/types/agents'
import { buildMediaPrompt } from '@/lib/ai/prompts/media'
import { runAgent } from '@/lib/ai/runner'
import { validateMediaOutput } from '@/lib/validation'

export async function mediaAgent(
  input: MediaInput
): Promise<AgentResult<MediaOutput>> {
  const prompt = buildMediaPrompt(
    input.context.series,
    input.strategy,
    input.script,
    input.context.platform
  )
  return runAgent<MediaOutput>('MediaAgent', prompt, validateMediaOutput)
}
