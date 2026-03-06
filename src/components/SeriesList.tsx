'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Series = {
  id: string
  name: string
  niche: string
  tone: string
  length_seconds: number
  created_at: string
}

type Props = { refreshTrigger: number }

export default function SeriesList({ refreshTrigger }: Props) {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSeries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('series').select('*').order('created_at', { ascending: false })
    if (!error && data) setSeries(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSeries() }, [fetchSeries, refreshTrigger])

  if (loading) return <p className="text-sm text-gray-500">Loading series...</p>
  if (series.length === 0) return <p className="text-sm text-gray-500">No series yet. Create one above!</p>

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">Your Series</h2>
      {series.map(s => (
        <div key={s.id} className="bg-white rounded-2xl shadow px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{s.name}</p>
            <p className="text-sm text-gray-500">{s.niche} · {s.tone} · {s.length_seconds}s</p>
          </div>
          <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  )
}
