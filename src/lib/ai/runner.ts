// ─────────────────────────────────────────────────────────────────────────────
// Shared agent runner
//
// Abstracts the repeated pattern of: call AI → parse JSON → validate → wrap result
// Every agent uses this instead of duplicating try/catch/JSON.parse.
// ─────────────────────────────────────────────────────────────────────────────

import { AgentResult } from '@/types/agents'
import { callAI } from '@/lib/ai/openai'

/**
 * Runs a single AI agent call with consistent error handling.
 *
 * @param agentName  Identifies the agent — passed to callAI and used in errors
 * @param prompt     The fully-built prompt string to send to the AI
 * @param validate   Optional runtime validator — returns true if the parsed
 *                   object has the expected shape. Returning false fails the agent.
 */
export async function runAgent<T>(
  agentName: string,
  prompt: string,
  validate?: (data: unknown) => data is T
): Promise<AgentResult<T>> {
  try {
    const raw = await callAI(prompt, agentName)

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return {
        success: false,
        error: `${agentName} returned invalid JSON: ${raw.slice(0, 200)}`,
      }
    }

    if (validate && !validate(parsed)) {
      return {
        success: false,
        error: `${agentName} returned JSON with missing or invalid fields`,
      }
    }

    return { success: true, data: parsed as T }
  } catch (error) {
    return {
      success: false,
      error: `${agentName} failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
