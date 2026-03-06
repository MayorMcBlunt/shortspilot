'use client'

import { useState } from 'react'
import SeriesForm from '@/components/series/SeriesForm'
import SeriesList from '@/components/series/SeriesList'

export default function DashboardClient() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  return (
    <>
      <SeriesForm onCreated={() => setRefreshTrigger(t => t + 1)} />
      <SeriesList refreshTrigger={refreshTrigger} />
    </>
  )
}
