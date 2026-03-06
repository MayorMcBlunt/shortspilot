# ShortsPilot Project Setup Script
# Run this in PowerShell from C:\Users\mmcna\Desktop\PostAutomation\shortspilot
# Command: .\setup.ps1

Write-Host "Creating folder structure..." -ForegroundColor Cyan

New-Item -ItemType Directory -Force "src\app\(auth)\login" | Out-Null
New-Item -ItemType Directory -Force "src\app\(auth)\signup" | Out-Null
New-Item -ItemType Directory -Force "src\app\dashboard" | Out-Null
New-Item -ItemType Directory -Force "src\components" | Out-Null
New-Item -ItemType Directory -Force "src\lib\supabase" | Out-Null
New-Item -ItemType Directory -Force "public" | Out-Null

Write-Host "Writing source files..." -ForegroundColor Cyan

# ─── src/app/(auth)/login/page.tsx ───
Set-Content "src\app\(auth)\login\page.tsx" @'
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sign in</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600 text-center">
          No account?{' '}
          <Link href="/signup" className="text-indigo-600 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
'@

# ─── src/app/(auth)/signup/page.tsx ───
Set-Content "src\app\(auth)\signup\page.tsx" @'
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create account</h1>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600 text-center">
          Have an account?{' '}
          <Link href="/login" className="text-indigo-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
'@

# ─── src/app/dashboard/page.tsx ───
Set-Content "src\app\dashboard\page.tsx" @'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <DashboardClient />
      </main>
    </div>
  )
}
'@

# ─── src/app/dashboard/DashboardClient.tsx ───
Set-Content "src\app\dashboard\DashboardClient.tsx" @'
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
'@

# ─── src/app/page.tsx ───
Set-Content "src\app\page.tsx" @'
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}
'@

# ─── src/app/layout.tsx ───
Set-Content "src\app\layout.tsx" @'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShortsPilot",
  description: "Manage your short-form video series",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
'@

# ─── src/app/globals.css ───
Set-Content "src\app\globals.css" '@import "tailwindcss";'

# ─── src/components/LogoutButton.tsx ───
Set-Content "src\components\LogoutButton.tsx" @'
'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button onClick={handleLogout}
      className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 transition">
      Sign out
    </button>
  )
}
'@

# ─── src/components/SeriesForm.tsx ───
Set-Content "src\components\SeriesForm.tsx" @'
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
'@

# ─── src/components/SeriesList.tsx ───
Set-Content "src\components\SeriesList.tsx" @'
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
'@

# ─── src/lib/supabase/client.ts ───
Set-Content "src\lib\supabase\client.ts" @'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
'@

# ─── src/lib/supabase/server.ts ───
Set-Content "src\lib\supabase\server.ts" @'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
'@

Write-Host ""
Write-Host "All files written successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. npm install" -ForegroundColor White
Write-Host "  2. npm run dev" -ForegroundColor White
Write-Host "  3. Open http://localhost:3000" -ForegroundColor White
