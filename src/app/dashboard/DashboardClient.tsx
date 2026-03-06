'use client'

import { useState } from 'react'
import SeriesForm from '@/components/SeriesForm'
import SeriesList from '@/components/SeriesList'

export default function DashboardClient() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  return (
    <>
      <SeriesForm onCreated={() => setRefreshTrigger(t => t + 1)} />
      <SeriesList refreshTrigger={refreshTrigger} />
    </>
  )
}
