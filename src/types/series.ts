// Pacing style controls how aggressively segments are cut and how many
// talking points the script agent targets.
export type PacingStyle = 'fast' | 'medium' | 'slow'

// Visual style biases the media agent toward B-roll, talking head, or a mix.
export type VisualStyle = 'b-roll' | 'talking-head' | 'mixed'

export type Series = {
  id: string
  user_id: string
  name: string
  niche: string
  tone: string

  // ── Duration ─────────────────────────────────────────────────────────────
  // length_seconds is kept for backward compatibility with existing rows.
  // New rows should set min_seconds + max_seconds and leave length_seconds null.
  // Consumers must call effectiveDurationRange(series) to get a reliable range.
  length_seconds: number | null

  // Soft duration range — the script targets this window, not a hard length.
  // If null, falls back to a range derived from length_seconds.
  min_seconds: number | null
  max_seconds: number | null

  // ── Creative controls ─────────────────────────────────────────────────────
  pacing_style: PacingStyle | null   // default: 'medium'
  visual_style: VisualStyle | null   // default: 'mixed'

  created_at: string
}

export type CreateSeriesInput = Omit<Series, 'id' | 'user_id' | 'created_at'>

// ── Helper ────────────────────────────────────────────────────────────────────
// Returns a guaranteed [min, max] duration range for any series, whether old
// (length_seconds only) or new (min/max set directly).
export function effectiveDurationRange(series: Series): { min: number; max: number } {
  if (series.min_seconds && series.max_seconds) {
    return { min: series.min_seconds, max: series.max_seconds }
  }
  // Backward compat: derive a ±20% range from the old fixed value
  const mid = series.length_seconds ?? 30
  return {
    min: Math.round(mid * 0.8),
    max: Math.round(mid * 1.2),
  }
}
