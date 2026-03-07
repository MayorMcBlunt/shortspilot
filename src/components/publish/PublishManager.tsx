'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ContentQueueRow } from '@/types/content'

type Account = {
  id: string
  platform: string
  account_name: string | null
  is_active: boolean
  connected_at: string
}

type PublishJob = {
  id: string
  queue_item_id: string
  status: string
  external_post_url: string | null
  error_message: string | null
  created_at: string
}

// Must stay in sync with IN_FLIGHT_STATUSES in publishContent.ts.
// Note: 'refreshing_token' was removed — token refresh now happens inside getActiveYouTubeAccessToken.
const IN_FLIGHT_STATUSES = ['queued', 'validating', 'uploading', 'processing']

function getDisabledReason(
  item: ContentQueueRow,
  hasYoutubeAccount: boolean,
  hasInFlightJob: boolean
): string | null {
  if (!hasYoutubeAccount) return 'Connect a YouTube account first.'
  if (item.platform !== 'youtube') return 'Manual publishing for this platform is not integrated yet.'
  if (!item.video_url) return 'No video — generate one before publishing.'
  if (hasInFlightJob) return 'A publish job is already running for this item.'
  return null
}

export default function PublishManager({
  readyItems,
  accounts,
  recentJobs,
}: {
  readyItems: ContentQueueRow[]
  accounts: Account[]
  recentJobs: PublishJob[]
}) {
  const activeYoutubeAccount = useMemo(
    () => accounts.find((a) => a.platform === 'youtube' && a.is_active),
    [accounts]
  )

  const [loadingItemId, setLoadingItemId] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [globalMessage, setGlobalMessage] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  async function publish(queueItemId: string) {
    setLoadingItemId(queueItemId)
    setGlobalError(null)
    setGlobalMessage(null)

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueItemId,
          connectedAccountId: activeYoutubeAccount?.id,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error ?? 'Publish failed')
      }

      setGlobalMessage('Published successfully. Refreshing...')
      window.location.reload()
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setLoadingItemId(null)
    }
  }

  async function disconnect(accountId: string) {
    setDisconnecting(true)
    setGlobalError(null)
    setGlobalMessage(null)

    try {
      const res = await fetch(`/api/publish/accounts/${accountId}/disconnect`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error ?? 'Disconnect failed')
      }
      setGlobalMessage('YouTube account disconnected.')
      window.location.reload()
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : 'Disconnect failed')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Connected account bar ── */}
      <div className="bg-white rounded-2xl shadow p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Connected Accounts</h3>
            <p className="text-xs text-gray-500">Phase 1 supports YouTube publishing.</p>
          </div>

          {!activeYoutubeAccount ? (
            <a
              href="/api/publish/accounts/youtube/connect"
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Connect YouTube
            </a>
          ) : (
            <button
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={disconnecting}
              onClick={() => disconnect(activeYoutubeAccount.id)}
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>

        {activeYoutubeAccount ? (
          <p className="text-sm text-green-700">
            Connected: <strong>{activeYoutubeAccount.account_name ?? 'YouTube Channel'}</strong>
          </p>
        ) : (
          <p className="text-sm text-amber-700">No active YouTube account connected.</p>
        )}
      </div>

      {/* ── Global status messages ── */}
      {globalMessage && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {globalMessage}
        </div>
      )}
      {globalError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {globalError}
        </div>
      )}

      {/* ── Ready to publish items ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Ready To Publish
            <span className="ml-2 text-sm font-normal text-gray-400">({readyItems.length})</span>
          </h3>
          {readyItems.length > 0 && (
            <p className="text-xs text-gray-400">Review the video preview before publishing</p>
          )}
        </div>

        {readyItems.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-500">
            No items are marked ready to publish yet. Approve content and generate a video first.
          </div>
        )}

        <div className="space-y-4">
          {readyItems.map((item) => {
            // Use the most-recent job for this item (jobs are ordered desc by created_at from the server).
            const itemJob = recentJobs.filter((j) => j.queue_item_id === item.id)[0] ?? null
            const hasInFlightJob = Boolean(itemJob && IN_FLIGHT_STATUSES.includes(itemJob.status))
            const disabledReason = getDisabledReason(item, Boolean(activeYoutubeAccount), hasInFlightJob)
            const isLoading = loadingItemId === item.id

            return (
              <div key={item.id} className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="flex flex-col md:flex-row">

                  {/* Video preview panel */}
                  {item.video_url ? (
                    <div className="bg-gray-900 flex items-center justify-center p-4 md:w-44 shrink-0">
                      <video
                        src={item.video_url}
                        controls
                        playsInline
                        muted
                        className="rounded-lg w-full md:w-32"
                        style={{ aspectRatio: '9/16' }}
                      >
                        Video preview unavailable
                      </video>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border-b md:border-b-0 md:border-r border-amber-100 flex items-center justify-center p-4 md:w-44 shrink-0">
                      <div className="text-center">
                        <p className="text-xs font-medium text-amber-700">No video</p>
                        <p className="text-xs text-amber-600 mt-1">Generate one first</p>
                      </div>
                    </div>
                  )}

                  {/* Content + actions */}
                  <div className="flex-1 px-5 py-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-gray-400 uppercase font-medium">{item.platform}</span>
                          <p className="font-semibold text-gray-900 truncate mt-0.5">
                            {item.review_edits?.title ?? item.title}
                          </p>
                          <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                            {item.review_edits?.hook ?? item.hook}
                          </p>
                        </div>
                        <Link
                          href={`/content/${item.id}`}
                          className="shrink-0 text-xs text-indigo-500 hover:underline whitespace-nowrap"
                        >
                          Edit →
                        </Link>
                      </div>

                      {/* Job status — last publish attempt */}
                      {itemJob && (
                        <p className="text-xs text-gray-500 mt-2">
                          Last publish:{' '}
                          <strong
                            className={
                              itemJob.status === 'completed'
                                ? 'text-green-700'
                                : itemJob.status === 'failed' || itemJob.status === 'canceled'
                                ? 'text-red-600'
                                : 'text-amber-600'
                            }
                          >
                            {itemJob.status}
                          </strong>
                          {itemJob.external_post_url && (
                            <a
                              href={itemJob.external_post_url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-indigo-600 underline"
                            >
                              Open ↗
                            </a>
                          )}
                        </p>
                      )}
                      {itemJob?.error_message && (
                        <p className="text-xs text-red-600 mt-1 line-clamp-2">{itemJob.error_message}</p>
                      )}
                    </div>

                    {/* Publish button + disabled reason */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100 mt-1">
                      {disabledReason ? (
                        <p className="text-xs text-amber-700">{disabledReason}</p>
                      ) : (
                        <span />
                      )}
                      <button
                        onClick={() => publish(item.id)}
                        disabled={Boolean(disabledReason) || isLoading}
                        className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {isLoading ? 'Publishing…' : 'Publish to YouTube'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
