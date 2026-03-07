'use client'

import { useMemo, useState } from 'react'
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

const IN_FLIGHT_STATUSES = ['queued', 'validating', 'refreshing_token', 'uploading', 'processing']

function getDisabledReason(
  item: ContentQueueRow,
  hasYoutubeAccount: boolean,
  hasInFlightJob: boolean
): string | null {
  if (!hasYoutubeAccount) return 'Connect a YouTube account first.'
  if (item.platform !== 'youtube') return 'Manual publishing for this platform is not integrated yet.'
  if (!item.video_url) return 'Generate and approve a video before publishing.'
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
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function publish(queueItemId: string) {
    setLoadingItemId(queueItemId)
    setError(null)
    setMessage(null)

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

      setMessage('Published successfully. Refreshing...')
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setLoadingItemId(null)
    }
  }

  async function disconnect(accountId: string) {
    setDisconnecting(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/publish/accounts/${accountId}/disconnect`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error ?? 'Disconnect failed')
      }
      setMessage('YouTube account disconnected.')
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-4">
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

      {message && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{message}</div>}
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="space-y-3">
        {readyItems.map((item) => {
          const itemJob = recentJobs.find((j) => j.queue_item_id === item.id)
          const hasInFlightJob = Boolean(itemJob && IN_FLIGHT_STATUSES.includes(itemJob.status))
          const disabledReason = getDisabledReason(item, Boolean(activeYoutubeAccount), hasInFlightJob)

          return (
            <div key={item.id} className="bg-white rounded-2xl shadow px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{item.review_edits?.title ?? item.title}</p>
                <p className="text-xs text-gray-500 uppercase">{item.platform}</p>
                {disabledReason && <p className="text-xs text-amber-700 mt-1">{disabledReason}</p>}
                {itemJob && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last publish job: <strong>{itemJob.status}</strong>
                    {itemJob.external_post_url && (
                      <a href={itemJob.external_post_url} target="_blank" className="ml-2 text-indigo-600 underline" rel="noreferrer">
                        Open
                      </a>
                    )}
                  </p>
                )}
                {itemJob?.error_message && (
                  <p className="text-xs text-red-600 mt-1">{itemJob.error_message}</p>
                )}
              </div>

              <button
                onClick={() => publish(item.id)}
                disabled={Boolean(disabledReason) || loadingItemId === item.id}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loadingItemId === item.id ? 'Publishing...' : 'Publish to YouTube'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
