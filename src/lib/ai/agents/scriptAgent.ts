import { AgentResult, ScriptInput, ScriptOutput } from '@/types/agents'
import { buildScriptPrompt } from '@/lib/ai/prompts/script'
import { runAgent } from '@/lib/ai/runner'
import { validateScriptOutput } from '@/lib/validation'

export async function scriptAgent(
  input: ScriptInput
): Promise<AgentResult<ScriptOutput>> {
  const prompt = buildScriptPrompt(input.context.series, input.strategy)

  const result = await runAgent<ScriptOutput>('ScriptAgent', prompt, validateScriptOutput)

  // Post-process: calculate real word count after validation passes
  if (result.success) {
    const wordCount = result.data.fullScript.trim().split(/\s+/).length
    return { success: true, data: { ...result.data, wordCount } }
  }

  return result
}
