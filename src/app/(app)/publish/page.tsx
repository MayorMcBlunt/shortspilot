import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getQueueItems } from '@/lib/jobs/reviewQueue'
import StatusBadge from '@/components/ui/StatusBadge'
import PublishManager from '@/components/publish/PublishManager'

type ConnectedAccountView = {
  id: string
  platform: string
  account_name: string | null
  is_active: boolean
  connected_at: string
}

type PublishJobView = {
  id: string
  queue_item_id: string
  status: string
  external_post_url: string | null
  error_message: string | null
  created_at: string
}

async function loadConnectedAccounts(userId: string): Promise<ConnectedAccountView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('connected_accounts')
    .select('id, platform, account_name, is_active, connected_at')
    .eq('user_id', userId)
    .order('connected_at', { ascending: false })

  if (error) {
    if ((error as { code?: string }).code === '42P01') return []
    throw new Error(error.message)
  }

  return (data ?? []) as ConnectedAccountView[]
}

async function loadRecentPublishJobs(userId: string): Promise<PublishJobView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('publish_jobs')
    .select('id, queue_item_id, status, external_post_url, error_message, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    if ((error as { code?: string }).code === '42P01') return []
    throw new Error(error.message)
  }

  return (data ?? []) as PublishJobView[]
}

export default async function PublishPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; connect_error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const items = await getQueueItems(user.id)
  const readyItems = items.filter((i) => i.status === 'ready_to_publish')
  const approvedItems = items.filter((i) => i.status === 'approved')
  const publishedItems = items.filter((i) => i.status === 'published')
  const accounts = await loadConnectedAccounts(user.id)
  const recentJobs = await loadRecentPublishJobs(user.id)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Publish</h1>
        <p className="text-sm text-gray-500">
          Publishing is manual. Connect YouTube, review the video preview, then publish items marked ready.
        </p>
      </div>

      {sp.connected === 'youtube' && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          YouTube account connected successfully.
        </div>
      )}

      {sp.connect_error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 break-words">
          YouTube connect failed: {sp.connect_error}
        </div>
      )}

      {/*
        PublishManager handles:
          - Connected accounts panel
          - "Ready to Publish" list with inline video previews + publish buttons
        Items are not listed again below — avoids duplication.
      */}
      <PublishManager readyItems={readyItems} accounts={accounts} recentJobs={recentJobs} />

      {/* ── Approved — waiting for video generation / publish prep ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">
          Approved
          <span className="ml-2 text-sm font-normal text-gray-400">({approvedItems.length})</span>
        </h2>
        {approvedItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-500">
            No approved items waiting for publish prep.
          </div>
        ) : (
          approvedItems.map((item) => (
            <Link
              key={item.id}
              href={`/content/${item.id}`}
              className="block bg-white rounded-2xl shadow px-6 py-4 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-gray-400 uppercase">{item.platform}</span>
                  </div>
                  <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">
                    {item.review_edits?.title ?? item.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Generate a video then mark Ready to Publish from the review editor.
                  </p>
                </div>
                <span className="text-xs text-gray-400 mt-1 shrink-0">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))
        )}
      </section>

      {/* ── Published history ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">
          Published
          <span className="ml-2 text-sm font-normal text-gray-400">({publishedItems.length})</span>
        </h2>
        {publishedItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-500">
            No items have been published yet.
          </div>
        ) : (
          publishedItems.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-gray-400 uppercase">{item.platform}</span>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {item.review_edits?.title ?? item.title}
                  </p>
                  {item.published_url ? (
                    <a
                      href={item.published_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-indigo-600 underline"
                    >
                      Open published post ↗
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Published URL not recorded.</p>
                  )}
                  {item.published_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Published {new Date(item.published_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-1 shrink-0">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
