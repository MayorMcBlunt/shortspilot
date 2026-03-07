import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveYouTubeAccessToken } from '@/lib/services/youtubeAccount'
import { fetchYouTubeVideoStats, type YouTubeVideoStats } from '@/lib/services/youtube'
import type { ReviewStatus } from '@/types/agents'

type StatusCounts = Record<ReviewStatus, number>

type PublishJobRow = {
  status: string
  created_at: string
  external_post_id?: string | null
}

const ZERO_COUNTS: StatusCounts = {
  pending_review: 0,
  needs_edits: 0,
  approved: 0,
  video_rendering: 0,
  video_ready: 0,
  ready_to_publish: 0,
  rejected: 0,
  published: 0,
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [seriesRes, queueRes, videoRes, publishRes] = await Promise.all([
    supabase.from('series').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('content_queue').select('status').eq('user_id', user.id),
    supabase.from('video_jobs').select('status').eq('user_id', user.id),
    supabase
      .from('publish_jobs')
      .select('status, created_at, external_post_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const seriesCount = seriesRes.count ?? 0

  const statusCounts = { ...ZERO_COUNTS }
  const queueItems = queueRes.data ?? []
  for (const item of queueItems) {
    const status = item.status as ReviewStatus
    if (status in statusCounts) {
      statusCounts[status] += 1
    }
  }

  const totalQueue = queueItems.length
  const totalPublished = statusCounts.published
  const totalReady = statusCounts.ready_to_publish
  const totalVideoReady = statusCounts.video_ready

  const videoJobs = videoRes.data ?? []
  const videoCompleted = videoJobs.filter((j) => j.status === 'completed').length
  const videoFailed = videoJobs.filter((j) => j.status === 'failed').length
  const videoProcessing = videoJobs.filter((j) => j.status === 'processing' || j.status === 'queued').length

  const publishJobs = (publishRes.error ? [] : publishRes.data ?? []) as PublishJobRow[]
  const publishCompleted = publishJobs.filter((j) => j.status === 'completed').length
  const publishFailed = publishJobs.filter((j) => j.status === 'failed').length
  const publishInFlight = publishJobs.filter((j) => ['queued', 'validating', 'refreshing_token', 'uploading', 'processing'].includes(j.status)).length

  const dbWarnings: string[] = []
  if (queueRes.error) dbWarnings.push(`Queue analytics unavailable: ${queueRes.error.message}`)
  if (videoRes.error) dbWarnings.push(`Video analytics unavailable: ${videoRes.error.message}`)
  if (publishRes.error) {
    const missingPublishTables = (publishRes.error as { code?: string }).code === '42P01'
    dbWarnings.push(
      missingPublishTables
        ? 'Publish analytics unavailable until publishing migration is applied.'
        : `Publish analytics unavailable: ${publishRes.error.message}`
    )
  }

  let youtubeStats: YouTubeVideoStats[] = []
  let youtubeStatsWarning: string | null = null

  const completedVideoIds = publishJobs
    .filter((job) => job.status === 'completed' && typeof job.external_post_id === 'string' && job.external_post_id.trim() !== '')
    .map((job) => job.external_post_id!.trim())

  if (completedVideoIds.length === 0) {
    youtubeStatsWarning = 'No completed YouTube publish jobs with video IDs yet.'
  } else {
    const access = await getActiveYouTubeAccessToken(user.id)
    if (!access.success) {
      youtubeStatsWarning = `YouTube analytics unavailable: ${access.error}`
    } else {
      try {
        youtubeStats = await fetchYouTubeVideoStats(access.accessToken, completedVideoIds)
        if (youtubeStats.length === 0) {
          youtubeStatsWarning = 'YouTube analytics returned no video statistics yet.'
        }
      } catch (e) {
        youtubeStatsWarning = e instanceof Error ? e.message : 'Failed to load YouTube analytics.'
      }
    }
  }

  const totalViews = sum(youtubeStats.map((s) => s.viewCount))
  const totalLikes = sum(youtubeStats.map((s) => s.likeCount))
  const totalComments = sum(youtubeStats.map((s) => s.commentCount))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Analytics</h1>
        <p className="text-sm text-gray-500">
          Pipeline analytics is based on ShortsPilot workflow data. YouTube section uses live API stats for videos published through this app.
        </p>
      </div>

      {dbWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
          {dbWarnings.map((warning, idx) => (
            <p key={idx}>{warning}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Series" value={seriesCount} />
        <MetricCard label="Queue Items" value={totalQueue} />
        <MetricCard label="Published" value={totalPublished} subtitle={pct(totalPublished, totalQueue)} />
        <MetricCard label="Ready To Publish" value={totalReady} subtitle={`${totalVideoReady} with video ready`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Review Queue Status</h2>
          <div className="space-y-2 text-sm">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-gray-600">{status}</span>
                <span className="font-medium text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Video Render Jobs</h2>
          <div className="space-y-2 text-sm">
            <StatRow label="Completed" value={videoCompleted} />
            <StatRow label="In progress" value={videoProcessing} />
            <StatRow label="Failed" value={videoFailed} />
            <StatRow label="Success rate" value={pct(videoCompleted, videoCompleted + videoFailed)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Publish Jobs (manual publishing)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <StatBox label="Completed" value={publishCompleted} />
          <StatBox label="In progress" value={publishInFlight} />
          <StatBox label="Failed" value={publishFailed} />
          <StatBox label="Success rate" value={pct(publishCompleted, publishCompleted + publishFailed)} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">YouTube Performance (connected account)</h2>

        {youtubeStatsWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {youtubeStatsWarning}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <StatBox label="Views" value={totalViews} />
          <StatBox label="Likes" value={totalLikes} />
          <StatBox label="Comments" value={totalComments} />
        </div>

        {youtubeStats.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">Video</th>
                  <th className="py-2 pr-3 font-medium">Views</th>
                  <th className="py-2 pr-3 font-medium">Likes</th>
                  <th className="py-2 pr-3 font-medium">Comments</th>
                </tr>
              </thead>
              <tbody>
                {youtubeStats.slice(0, 10).map((video) => (
                  <tr key={video.videoId} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <a
                        href={`https://www.youtube.com/watch?v=${video.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        {video.title}
                      </a>
                    </td>
                    <td className="py-2 pr-3 text-gray-800">{video.viewCount}</td>
                    <td className="py-2 pr-3 text-gray-800">{video.likeCount}</td>
                    <td className="py-2 pr-3 text-gray-800">{video.commentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, subtitle }: { label: string; value: number; subtitle?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-gray-200 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}
