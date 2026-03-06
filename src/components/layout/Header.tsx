import LogoutButton from '@/components/auth/LogoutButton'
import { createClient } from '@/lib/supabase/server'

export default async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end gap-4">
      <span className="text-sm text-gray-500">{user?.email}</span>
      <LogoutButton />
    </header>
  )
}
