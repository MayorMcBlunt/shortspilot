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
 * Retries once automatically if validation fails (e.g. script too short).
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
  const MAX_ATTEMPTS = 2

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await callAI(prompt, agentName)

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        const jsonError = `${agentName} returned invalid JSON: ${raw.slice(0, 200)}`
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`[runAgent] ${jsonError} — retrying (attempt ${attempt}/${MAX_ATTEMPTS})`)
          continue
        }
        return { success: false, error: jsonError }
      }

      if (validate && !validate(parsed)) {
        const validationError = `${agentName} returned JSON with missing or invalid fields`
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`[runAgent] ${validationError} — retrying (attempt ${attempt}/${MAX_ATTEMPTS})`)
          continue
        }
        return { success: false, error: validationError }
      }

      return { success: true, data: parsed as T }
    } catch (error) {
      const thrownError = `${agentName} failed: ${error instanceof Error ? error.message : String(error)}`
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[runAgent] ${thrownError} — retrying (attempt ${attempt}/${MAX_ATTEMPTS})`)
        continue
      }
      return { success: false, error: thrownError }
    }
  }

  // Unreachable — loop always returns above
  return { success: false, error: `${agentName} failed after ${MAX_ATTEMPTS} attempts` }
}
