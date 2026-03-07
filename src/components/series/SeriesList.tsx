'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Series } from '@/types/series'
import { Platform, PLATFORM_CONFIGS } from '@/types/platform'

type Props = {
  refreshTrigger: number
}

type GenerationMessage = { ok: boolean; text: string }

const DEFAULT_PLATFORM: Platform = 'tiktok'

export default function SeriesList({ refreshTrigger }: Props) {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [platformBySeries, setPlatformBySeries] = useState<Record<string, Platform>>({})
  const [messages, setMessages] = useState<Record<string, GenerationMessage>>({})

  const fetchSeries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('series')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSeries(data)
      setPlatformBySeries(prev => {
        const next = { ...prev }
        for (const s of data) {
          if (!next[s.id]) next[s.id] = DEFAULT_PLATFORM
        }
        return next
      })
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetchSeries() }, [fetchSeries, refreshTrigger])

  async function handleGenerate(seriesId: string) {
    if (generating[seriesId]) return

    setGenerating(prev => ({ ...prev, [seriesId]: true }))
    setMessages(prev => ({ ...prev, [seriesId]: { ok: true, text: 'Generating content...' } }))

    try {
      const platform = platformBySeries[seriesId] ?? DEFAULT_PLATFORM

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId, platform }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Generation failed')
      }

      setMessages(prev => ({
        ...prev,
        [seriesId]: { ok: true, text: 'Content generated and added to review queue.' },
      }))
    } catch (error) {
      setMessages(prev => ({
        ...prev,
        [seriesId]: {
          ok: false,
          text: error instanceof Error ? error.message : 'Generation failed',
        },
      }))
    } finally {
      setGenerating(prev => ({ ...prev, [seriesId]: false }))
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading series...</p>
  if (series.length === 0) return <p className="text-sm text-gray-500">No series yet. Create one above!</p>

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">Your Series</h2>
      {series.map(s => {
        const isGenerating = Boolean(generating[s.id])
        const message = messages[s.id]
        const selectedPlatform = platformBySeries[s.id] ?? DEFAULT_PLATFORM

        return (
          <div key={s.id} className="bg-white rounded-2xl shadow px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-500">{s.niche} | {s.tone} | {s.length_seconds}s</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0 mt-1">{new Date(s.created_at).toLocaleDateString()}</span>
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <select
                value={selectedPlatform}
                onChange={e => setPlatformBySeries(prev => ({ ...prev, [s.id]: e.target.value as Platform }))}
                disabled={isGenerating}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-700"
              >
                {(Object.keys(PLATFORM_CONFIGS) as Platform[]).map(platform => (
                  <option key={platform} value={platform}>
                    {PLATFORM_CONFIGS[platform].name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleGenerate(s.id)}
                disabled={isGenerating}
                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {message && (
              <p className={`mt-2 text-xs ${message.ok ? 'text-green-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
