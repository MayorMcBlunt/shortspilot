import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getQueueItem } from '@/lib/jobs/reviewQueue'
import ReviewEditor from '@/components/content/ReviewEditor'

type Props = { params: { id: string } }

export default async function ReviewItemPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const item = await getQueueItem(params.id, user.id).catch(() => null)
  if (!item) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <ReviewEditor item={item} />
    </div>
  )
}
