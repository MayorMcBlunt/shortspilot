import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getQueueItems } from '@/lib/jobs/reviewQueue'
import StatusBadge from '@/components/ui/StatusBadge'

export default async function PublishPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const items = await getQueueItems(user.id)
  const readyItems = items.filter(i => i.status === 'ready_to_publish')
  const approvedItems = items.filter(i => i.status === 'approved')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Publish</h1>
        <p className="text-sm text-gray-500">
          Ready items can be manually published. Approved items are reviewed but not yet marked ready.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Ready To Publish ({readyItems.length})</h2>
        {readyItems.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-500">
            No items are marked ready to publish yet.
          </div>
        )}
        {readyItems.map(item => (
          <Link
            key={item.id}
            href={`/content/${item.id}`}
            className="block bg-white rounded-2xl shadow px-6 py-4 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={item.status} />
                  <span className="text-xs text-gray-400 uppercase">{item.platform}</span>
                </div>
                <p className="font-semibold text-gray-900">{item.review_edits?.title ?? item.title}</p>
                <p className="text-sm text-gray-500">{item.review_edits?.hook ?? item.hook}</p>
              </div>
              <span className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Approved ({approvedItems.length})</h2>
        {approvedItems.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-500">
            No approved items waiting for publish prep.
          </div>
        )}
        {approvedItems.map(item => (
          <Link
            key={item.id}
            href={`/content/${item.id}`}
            className="block bg-white rounded-2xl shadow px-6 py-4 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={item.status} />
                  <span className="text-xs text-gray-400 uppercase">{item.platform}</span>
                </div>
                <p className="font-semibold text-gray-900">{item.review_edits?.title ?? item.title}</p>
                <p className="text-sm text-gray-500">Mark this item Ready to Publish from the review editor.</p>
              </div>
              <span className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
