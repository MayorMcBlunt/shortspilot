// ─────────────────────────────────────────────────────────────────────────────
// Content Generation Orchestrator
//
// This is the ONLY entry point for running the agent pipeline.
// It runs agents in sequence, passing each output into the next agent.
// If any agent fails, the entire job fails and nothing is saved.
// The final output is a ContentPackage saved to the content_queue table
// with status 'pending_review' — no content is ever auto-published.
//
// Flow:
//   strategyAgent → scriptAgent → mediaAgent (parallel with captionAgent)
//     → packagingAgent → save to content_queue
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { strategyAgent } from '@/lib/ai/agents/strategyAgent'
import { scriptAgent } from '@/lib/ai/agents/scriptAgent'
import { mediaAgent } from '@/lib/ai/agents/mediaAgent'
import { captionAgent } from '@/lib/ai/agents/captionAgent'
import { packagingAgent } from '@/lib/ai/agents/packagingAgent'
import { AgentContext } from '@/types/agents'
import { Series } from '@/types/series'
import { Platform } from '@/types/platform'
import { v4 as uuidv4 } from 'uuid'

export type OrchestrationResult =
  | { success: true; queueItemId: string; jobId: string }
  | { success: false; error: string; failedAgent: string }

export async function runContentPipeline(
  series: Series,
  platform: Platform,
  userId: string
): Promise<OrchestrationResult> {

  const jobId = uuidv4()

  const context: AgentContext = {
    series,
    platform,
    userId,
    jobId,
  }

  // ── Step 1: Strategy ───────────────────────────────────────────────────────
  const strategyResult = await strategyAgent({ context })
  if (!strategyResult.success) {
    return { success: false, error: strategyResult.error, failedAgent: 'strategy' }
  }

  // ── Step 2: Script (depends on strategy) ──────────────────────────────────
  const scriptResult = await scriptAgent({ context, strategy: strategyResult.data })
  if (!scriptResult.success) {
    return { success: false, error: scriptResult.error, failedAgent: 'script' }
  }

  // ── Step 3: Media + Caption run in parallel (both depend on script) ────────
  const [mediaResult, captionResult] = await Promise.all([
    mediaAgent({ context, strategy: strategyResult.data, script: scriptResult.data }),
    captionAgent({ context, strategy: strategyResult.data, script: scriptResult.data }),
  ])

  // Surface all parallel failures, not just the first one
  const parallelErrors: string[] = []
  if (!mediaResult.success) parallelErrors.push(`media: ${mediaResult.error}`)
  if (!captionResult.success) parallelErrors.push(`caption: ${captionResult.error}`)
  if (parallelErrors.length > 0) {
    return {
      success: false,
      error: parallelErrors.join(' | '),
      failedAgent: parallelErrors.length > 1 ? 'media+caption' : parallelErrors[0].split(':')[0],
    }
  }

  // ── Step 4: Packaging ──────────────────────────────────────────────────────
  const packageResult = await packagingAgent({
    context,
    strategy: strategyResult.data,
    script: scriptResult.data,
    media: mediaResult.data!,
    caption: captionResult.data!,
  })
  if (!packageResult.success) {
    return { success: false, error: packageResult.error, failedAgent: 'packaging' }
  }

  // ── Step 5: Save to review queue ───────────────────────────────────────────
  // Status is always 'pending_review' — never auto-published.
  // The package JSONB is the immutable generated content.
  // Review state lives only in the DB row columns.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_queue')
    .insert({
      job_id: jobId,
      user_id: userId,
      series_id: series.id,
      platform,
      status: 'pending_review',
      title: packageResult.data.caption.title,
      hook: packageResult.data.script.hook,
      package: packageResult.data,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    return {
      success: false,
      error: `Failed to save to queue: ${error.message}`,
      failedAgent: 'database',
    }
  }

  return { success: true, queueItemId: data.id, jobId }
}
