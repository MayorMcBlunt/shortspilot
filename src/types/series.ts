export type Series = {
  id: string
  user_id: string
  name: string
  niche: string
  tone: string
  length_seconds: number
  created_at: string
}

export type CreateSeriesInput = Omit<Series, 'id' | 'user_id' | 'created_at'>
