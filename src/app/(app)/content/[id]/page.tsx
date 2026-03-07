import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getQueueItem } from '@/lib/jobs/reviewQueue'
import ReviewEditor from '@/components/content/ReviewEditor'

export const dynamic = 'force-dynamic'  // always fetch fresh data, never serve stale cache

type Props = { params: Promise<{ id: string }> }

export default async function ReviewItemPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const item = await getQueueItem(id, user.id)
  if (!item) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <ReviewEditor item={item} />
    </div>
  )
}
