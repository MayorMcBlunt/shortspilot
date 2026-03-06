import { AgentResult, StrategyInput, StrategyOutput } from '@/types/agents'
import { buildStrategyPrompt } from '@/lib/ai/prompts/strategy'
import { runAgent } from '@/lib/ai/runner'
import { validateStrategyOutput } from '@/lib/validation'

export async function strategyAgent(
  input: StrategyInput
): Promise<AgentResult<StrategyOutput>> {
  const prompt = buildStrategyPrompt(input.context.series, input.context.platform)
  return runAgent<StrategyOutput>('StrategyAgent', prompt, validateStrategyOutput)
}
