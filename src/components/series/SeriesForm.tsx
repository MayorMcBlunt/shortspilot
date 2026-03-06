'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = { onCreated: () => void }

export default function SeriesForm({ onCreated }: Props) {
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [tone, setTone] = useState('')
  const [lengthSeconds, setLengthSeconds] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const { error } = await supabase.from('series').insert({
      user_id: user.id, name, niche, tone,
      length_seconds: parseInt(lengthSeconds, 10),
    })

    if (error) {
      setError(error.message)
    } else {
      setName(''); setNiche(''); setTone(''); setLengthSeconds('')
      onCreated()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">New Series</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="My Cooking Series"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Niche</label>
          <input required value={niche} onChange={e => setNiche(e.target.value)} placeholder="Food & Cooking"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
          <input required value={tone} onChange={e => setTone(e.target.value)} placeholder="Casual & Friendly"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Length (seconds)</label>
          <input required type="number" min={1} value={lengthSeconds} onChange={e => setLengthSeconds(e.target.value)} placeholder="60"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading}
        className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
        {loading ? 'Creating...' : 'Create Series'}
      </button>
    </form>
  )
}
