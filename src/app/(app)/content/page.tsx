import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getQueueItems } from '@/lib/jobs/reviewQueue'
import QueueList from '@/components/content/QueueList'

export default async function ContentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const items = await getQueueItems(user.id)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review, edit, and approve generated content before publishing.
        </p>
      </div>
      <QueueList initialItems={items} />
    </div>
  )
}
