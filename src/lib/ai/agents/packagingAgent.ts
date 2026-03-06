import { AgentResult, PackagingInput, ContentPackage } from '@/types/agents'

export async function packagingAgent(
  input: PackagingInput
): Promise<AgentResult<ContentPackage>> {
  try {
    // ContentPackage is purely the immutable generated content.
    // Review state (status, notes, approvals) lives only on the DB row.
    const pkg: ContentPackage = {
      jobId: input.context.jobId,
      userId: input.context.userId,
      seriesId: input.context.series.id,
      platform: input.context.platform,
      generatedAt: new Date().toISOString(),

      strategy: input.strategy,
      script: input.script,
      media: input.media,
      caption: input.caption,
    }

    return { success: true, data: pkg }
  } catch (error) {
    return {
      success: false,
      error: `PackagingAgent failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
