'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PacingStyle, VisualStyle } from '@/types/series'

type Props = { onCreated: () => void }

const PACING_OPTIONS: { value: PacingStyle; label: string; hint: string }[] = [
  { value: 'fast',   label: 'Fast',   hint: 'Quick cuts, 3–5 punchy facts' },
  { value: 'medium', label: 'Medium', hint: 'Balanced pacing, 2–4 segments' },
  { value: 'slow',   label: 'Slow',   hint: 'Fuller sentences, 2–3 segments' },
]

const VISUAL_OPTIONS: { value: VisualStyle; label: string; hint: string }[] = [
  { value: 'b-roll',       label: 'B-Roll only',    hint: 'All stock footage' },
  { value: 'mixed',        label: 'Mixed',          hint: 'Hook/ending on camera, B-roll for facts' },
  { value: 'talking-head', label: 'Talking Head',   hint: 'All on-camera presenter' },
]

export default function SeriesForm({ onCreated }: Props) {
  const [name, setName]               = useState('')
  const [niche, setNiche]             = useState('')
  const [tone, setTone]               = useState('')
  const [minSeconds, setMinSeconds]   = useState('15')
  const [maxSeconds, setMaxSeconds]   = useState('30')
  const [pacing, setPacing]           = useState<PacingStyle>('medium')
  const [visual, setVisual]           = useState<VisualStyle>('mixed')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const min = parseInt(minSeconds, 10)
    const max = parseInt(maxSeconds, 10)

    if (!name.trim() || !niche.trim() || !tone.trim()) {
      setError('Name, niche, and tone are required.')
      return
    }
    if (!Number.isFinite(min) || min <= 0) {
      setError('Minimum duration must be a positive number.')
      return
    }
    if (!Number.isFinite(max) || max <= min) {
      setError('Maximum duration must be greater than minimum.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const { error: insertError } = await supabase.from('series').insert({
      user_id:      user.id,
      name:         name.trim(),
      niche:        niche.trim(),
      tone:         tone.trim(),
      min_seconds:  min,
      max_seconds:  max,
      // Backward compat midpoint — keeps length_seconds usable for older code paths
      length_seconds: Math.round((min + max) / 2),
      pacing_style: pacing,
      visual_style: visual,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setName(''); setNiche(''); setTone('')
      setMinSeconds('15'); setMaxSeconds('30')
      setPacing('medium'); setVisual('mixed')
      onCreated()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-5">
      <h2 className="text-lg font-semibold text-gray-800">New Series</h2>

      {/* Core identity */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Series Name</label>
          <input
            required value={name} onChange={e => setName(e.target.value)}
            placeholder="Space Facts"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Niche</label>
          <input
            required value={niche} onChange={e => setNiche(e.target.value)}
            placeholder="Astronomy & Space"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
          <input
            required value={tone} onChange={e => setTone(e.target.value)}
            placeholder="Curious & Mind-blowing"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Duration range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Target Duration
          <span className="ml-1.5 text-xs font-normal text-gray-400">
            — video length will be the natural result of the script within this range
          </span>
        </label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <input
              type="number" min={5} max={120} value={minSeconds}
              onChange={e => setMinSeconds(e.target.value)}
              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-500">s min</span>
          </div>
          <span className="text-gray-400">—</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min={5} max={120} value={maxSeconds}
              onChange={e => setMaxSeconds(e.target.value)}
              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-500">s max</span>
          </div>
          {/* Visual indicator */}
          <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">
            ~{Math.round((parseInt(minSeconds || '0') + parseInt(maxSeconds || '0')) / 2)}s target
          </span>
        </div>
      </div>

      {/* Pacing style */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Pacing Style</label>
        <div className="flex gap-2 flex-wrap">
          {PACING_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPacing(opt.value)}
              className={`px-3 py-2 rounded-xl border text-sm transition ${
                pacing === opt.value
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-gray-300 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              <span className="font-medium">{opt.label}</span>
              <span className={`ml-1.5 text-xs ${pacing === opt.value ? 'text-indigo-200' : 'text-gray-400'}`}>
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Visual style */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Visual Style</label>
        <div className="flex gap-2 flex-wrap">
          {VISUAL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVisual(opt.value)}
              className={`px-3 py-2 rounded-xl border text-sm transition ${
                visual === opt.value
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-gray-300 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              <span className="font-medium">{opt.label}</span>
              <span className={`ml-1.5 text-xs ${visual === opt.value ? 'text-indigo-200' : 'text-gray-400'}`}>
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit" disabled={loading}
        className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {loading ? 'Creating...' : 'Create Series'}
      </button>
    </form>
  )
}
