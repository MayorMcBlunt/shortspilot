'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Series, PacingStyle, VisualStyle, effectiveDurationRange } from '@/types/series'
import { Platform, PLATFORM_CONFIGS } from '@/types/platform'

type Props = {
  refreshTrigger: number
}

type GenerationMessage = { ok: boolean; text: string }

type SeriesDraft = {
  name: string
  niche: string
  tone: string
  min_seconds: string
  max_seconds: string
  pacing_style: PacingStyle
  visual_style: VisualStyle
}

const DEFAULT_PLATFORM: Platform = 'tiktok'

const PACING_LABELS: Record<PacingStyle, string> = {
  fast: 'Fast', medium: 'Medium', slow: 'Slow',
}
const VISUAL_LABELS: Record<VisualStyle, string> = {
  'b-roll': 'B-Roll', 'talking-head': 'Talking Head', mixed: 'Mixed',
}

export default function SeriesList({ refreshTrigger }: Props) {
  const [series, setSeries]             = useState<Series[]>([])
  const [loading, setLoading]           = useState(true)
  const [generating, setGenerating]     = useState<Record<string, boolean>>({})
  const [platformBySeries, setPlatformBySeries] = useState<Record<string, Platform>>({})
  const [messages, setMessages]         = useState<Record<string, GenerationMessage>>({})

  const [editingId, setEditingId]       = useState<string | null>(null)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [draft, setDraft]               = useState<SeriesDraft>({
    name: '', niche: '', tone: '',
    min_seconds: '15', max_seconds: '30',
    pacing_style: 'medium', visual_style: 'mixed',
  })

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

  function beginEdit(s: Series) {
    const { min, max } = effectiveDurationRange(s)
    setEditingId(s.id)
    setDraft({
      name: s.name,
      niche: s.niche,
      tone: s.tone,
      min_seconds: String(min),
      max_seconds: String(max),
      pacing_style: s.pacing_style ?? 'medium',
      visual_style: s.visual_style ?? 'mixed',
    })
    setMessages(prev => ({ ...prev, [s.id]: { ok: true, text: '' } }))
  }

  function cancelEdit() {
    setEditingId(null)
    setSavingEditId(null)
    setDraft({ name: '', niche: '', tone: '', min_seconds: '15', max_seconds: '30', pacing_style: 'medium', visual_style: 'mixed' })
  }

  async function saveEdit(seriesId: string) {
    const name = draft.name.trim()
    const niche = draft.niche.trim()
    const tone = draft.tone.trim()
    const min = Number(draft.min_seconds)
    const max = Number(draft.max_seconds)

    if (!name || !niche || !tone) {
      setMessages(prev => ({ ...prev, [seriesId]: { ok: false, text: 'Name, niche, and tone are required.' } }))
      return
    }
    if (!Number.isFinite(min) || min <= 0) {
      setMessages(prev => ({ ...prev, [seriesId]: { ok: false, text: 'Min duration must be positive.' } }))
      return
    }
    if (!Number.isFinite(max) || max <= min) {
      setMessages(prev => ({ ...prev, [seriesId]: { ok: false, text: 'Max duration must be greater than min.' } }))
      return
    }

    setSavingEditId(seriesId)
    setMessages(prev => ({ ...prev, [seriesId]: { ok: true, text: 'Saving...' } }))

    try {
      const res = await fetch(`/api/series/${seriesId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, niche, tone,
          min_seconds: Math.round(min),
          max_seconds: Math.round(max),
          pacing_style: draft.pacing_style,
          visual_style: draft.visual_style,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to update series')

      const updatedSeries = json.series as Series | undefined
      if (updatedSeries) {
        setSeries(prev => prev.map(s => (s.id === seriesId ? updatedSeries : s)))
      } else {
        await fetchSeries()
      }
      setMessages(prev => ({ ...prev, [seriesId]: { ok: true, text: 'Series updated.' } }))
      cancelEdit()
    } catch (error) {
      setMessages(prev => ({
        ...prev,
        [seriesId]: { ok: false, text: error instanceof Error ? error.message : 'Failed to update series' },
      }))
      setSavingEditId(null)
    }
  }

  async function handleDelete(seriesId: string) {
    if (!confirm('Delete this series? This cannot be undone.')) return
    setDeletingId(seriesId)
    setMessages(prev => ({ ...prev, [seriesId]: { ok: true, text: 'Deleting...' } }))

    try {
      const res = await fetch(`/api/series/${seriesId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Delete failed')
      setSeries(prev => prev.filter(s => s.id !== seriesId))
      if (editingId === seriesId) cancelEdit()
    } catch (error) {
      setMessages(prev => ({
        ...prev,
        [seriesId]: { ok: false, text: error instanceof Error ? error.message : 'Delete failed' },
      }))
      setDeletingId(null)
      return
    }
    setDeletingId(null)
  }

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
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Generation failed')
      setMessages(prev => ({ ...prev, [seriesId]: { ok: true, text: 'Content generated and added to review queue.' } }))
    } catch (error) {
      setMessages(prev => ({
        ...prev,
        [seriesId]: { ok: false, text: error instanceof Error ? error.message : 'Generation failed' },
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
        const isEditing = editingId === s.id
        const isSaving = savingEditId === s.id
        const isDeleting = deletingId === s.id
        const { min, max } = effectiveDurationRange(s)

        return (
          <div key={s.id} className="bg-white rounded-2xl shadow px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">

                {/* ── View mode ── */}
                {!isEditing ? (
                  <>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-sm text-gray-500">{s.niche}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-sm text-gray-500">{s.tone}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        {min}–{max}s
                      </span>
                      {s.pacing_style && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {PACING_LABELS[s.pacing_style]} pacing
                        </span>
                      )}
                      {s.visual_style && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {VISUAL_LABELS[s.visual_style]}
                        </span>
                      )}
                    </div>
                  </>
                ) : (

                  /* ── Edit mode ── */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        value={draft.name}
                        onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        placeholder="Series name"
                        disabled={isSaving || isDeleting}
                      />
                      <input
                        value={draft.niche}
                        onChange={e => setDraft(p => ({ ...p, niche: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        placeholder="Niche"
                        disabled={isSaving || isDeleting}
                      />
                      <input
                        value={draft.tone}
                        onChange={e => setDraft(p => ({ ...p, tone: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        placeholder="Tone"
                        disabled={isSaving || isDeleting}
                      />
                    </div>

                    {/* Duration range */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 font-medium">Duration:</span>
                      <input
                        type="number" min={5} max={120} value={draft.min_seconds}
                        onChange={e => setDraft(p => ({ ...p, min_seconds: e.target.value }))}
                        className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        disabled={isSaving || isDeleting}
                      />
                      <span className="text-xs text-gray-400">s –</span>
                      <input
                        type="number" min={5} max={120} value={draft.max_seconds}
                        onChange={e => setDraft(p => ({ ...p, max_seconds: e.target.value }))}
                        className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        disabled={isSaving || isDeleting}
                      />
                      <span className="text-xs text-gray-400">s</span>
                    </div>

                    {/* Pacing + visual selects */}
                    <div className="flex gap-2 flex-wrap">
                      <div>
                        <span className="text-xs text-gray-500 font-medium mr-1">Pacing:</span>
                        {(['fast', 'medium', 'slow'] as PacingStyle[]).map(p => (
                          <button key={p} type="button"
                            onClick={() => setDraft(d => ({ ...d, pacing_style: p }))}
                            disabled={isSaving || isDeleting}
                            className={`mr-1 px-2 py-0.5 rounded text-xs border transition ${
                              draft.pacing_style === p
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                            }`}
                          >{PACING_LABELS[p]}</button>
                        ))}
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 font-medium mr-1">Visual:</span>
                        {(['b-roll', 'mixed', 'talking-head'] as VisualStyle[]).map(v => (
                          <button key={v} type="button"
                            onClick={() => setDraft(d => ({ ...d, visual_style: v }))}
                            disabled={isSaving || isDeleting}
                            className={`mr-1 px-2 py-0.5 rounded text-xs border transition ${
                              draft.visual_style === v
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                            }`}
                          >{VISUAL_LABELS[v]}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {!isEditing ? (
                  <>
                    <button type="button" onClick={() => beginEdit(s)} disabled={isDeleting}
                      className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition disabled:opacity-50">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(s.id)} disabled={isDeleting || isGenerating}
                      className="border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50 transition disabled:opacity-50">
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => saveEdit(s.id)} disabled={isSaving || isDeleting}
                      className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelEdit} disabled={isSaving || isDeleting}
                      className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50">
                      Cancel
                    </button>
                  </>
                )}
                <span className="text-xs text-gray-400 shrink-0 mt-1">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Generate controls */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <select
                value={selectedPlatform}
                onChange={e => setPlatformBySeries(prev => ({ ...prev, [s.id]: e.target.value as Platform }))}
                disabled={isGenerating || isEditing || isDeleting}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-700"
              >
                {(Object.keys(PLATFORM_CONFIGS) as Platform[]).map(platform => (
                  <option key={platform} value={platform}>
                    {PLATFORM_CONFIGS[platform].name}
                  </option>
                ))}
              </select>

              <button type="button" onClick={() => handleGenerate(s.id)}
                disabled={isGenerating || isEditing || isDeleting}
                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {message?.text && (
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
