'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ContentQueueItemFull } from '@/types/content'
import { ReviewEdits } from '@/types/agents'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import StatusBadge from '@/components/ui/StatusBadge'

// â”€â”€ Merge helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Merges the immutable package with any human overrides in review_edits.
// The original package is never modified - this is display-only merging.
function mergeWithEdits(item: ContentQueueItemFull): ReviewEdits & {
  title: string
  hook: string
  fullScript: string
  primaryCaption: string
  hashtags: string[]
  reviewNotes: string
} {
  const p = item.package
  const e = item.review_edits ?? {}
  return {
    title:          e.title          ?? p.caption.title,
    hook:           e.hook           ?? p.script.hook,
    fullScript:     e.fullScript     ?? p.script.fullScript,
    primaryCaption: e.primaryCaption ?? p.caption.primaryCaption,
    hashtags:       e.hashtags       ?? p.caption.hashtags,
    reviewNotes:    item.review_notes ?? '',
  }
}

// Reconstruct fullScript from structured fields whenever segments are edited.
function assembleFullScript(hook: string, segments: string[], ending: string): string {
  return [hook, ...segments, ending]
    .map(s => s.trim())
    .filter(Boolean)
    .join(' ')
}

export default function ReviewEditor({ item }: { item: ContentQueueItemFull }) {
  const router = useRouter()
  const merged = mergeWithEdits(item)

  // Local edit state - starts from merged (package + any existing edits)
  const [title, setTitle]               = useState(merged.title)
  const [hook, setHook]                 = useState(merged.hook)
  // Segments: use structured fields when available, fall back to fullScript split
  const [segments, setSegments]         = useState<string[]>(
    item.package.script.segments ?? [merged.fullScript]
  )
  const [ending, setEnding]             = useState(
    item.package.script.ending ?? ''
  )
  // fullScript is always derived - never edited directly in the UI
  const fullScript = assembleFullScript(hook, segments, ending)
  const [primaryCaption, setPrimaryCaption] = useState(merged.primaryCaption)
  const [hashtagsRaw, setHashtagsRaw]   = useState(merged.hashtags.join(', '))
  const [reviewNotes, setReviewNotes]   = useState(merged.reviewNotes)
  const [rejectReason, setRejectReason] = useState('')

  const [saving, setSaving]           = useState(false)
  const [acting, setActing]           = useState(false)
  const [rendering, setRendering]     = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const [liveStatus, setLiveStatus]   = useState(item.status)
  const [liveVideoUrl, setLiveVideoUrl] = useState(item.video_url)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const [showReject, setShowReject]   = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // -- Fix hydration: date formatted client-side only
  const [generatedAtDisplay, setGeneratedAtDisplay] = useState('')
  useEffect(() => {
    setGeneratedAtDisplay(new Date(item.package.generatedAt).toLocaleString())
  }, [item.package.generatedAt])

  // Keep local live state aligned when server props change after refresh.
  useEffect(() => {
    setLiveStatus(item.status)
    setLiveVideoUrl(item.video_url)
  }, [item.status, item.video_url])

  // -- Auto-poll while video is rendering
  // Polls /api/queue/[id]/status every 2s and refreshes when video becomes ready.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (liveStatus !== 'video_rendering') {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/queue/${item.id}/status?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return

        const { status, video_url } = await res.json()

        if (typeof status === 'string') {
          setLiveStatus(status as typeof item.status)
        }
        if (typeof video_url === 'string' || video_url === null) {
          setLiveVideoUrl(video_url)
        }

        if (status !== 'video_rendering') {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setRefreshing(true)
          router.refresh()

          // Fallback: clear overlay even if refresh is delayed.
          setTimeout(() => setRefreshing(false), 2500)
        }
      } catch {
        // network hiccup - keep polling
      }
    }, 2000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [liveStatus, item.id, router])

  const effectiveStatus = liveStatus
  const effectiveVideoUrl = liveVideoUrl ?? item.video_url
  const isTerminal = effectiveStatus === 'rejected' || effectiveStatus === 'published'
  const isRendering = effectiveStatus === 'video_rendering'
  const hasVideo = Boolean(effectiveVideoUrl)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // â”€â”€ API call helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function callAction(body: object) {
    const res = await fetch(`/api/queue/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Request failed')
    return json
  }

  // â”€â”€ Save edits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSaveEdits() {
    setSaving(true)
    try {
      const edits: ReviewEdits = {}
      if (title !== item.package.caption.title)               edits.title = title
      if (hook !== item.package.script.hook)                  edits.hook = hook
      // fullScript is derived from hook+segments+ending - save it if any part changed
      if (fullScript !== item.package.script.fullScript) edits.fullScript = fullScript
      if (primaryCaption !== item.package.caption.primaryCaption) edits.primaryCaption = primaryCaption
      const hashtags = hashtagsRaw.split(',').map(h => h.trim()).filter(Boolean)
      if (JSON.stringify(hashtags) !== JSON.stringify(item.package.caption.hashtags)) edits.hashtags = hashtags

      const notesChanged = reviewNotes !== (item.review_notes ?? '')

      await callAction({ action: 'save_edits', edits })
      if (notesChanged) await callAction({ action: 'update_notes', notes: reviewNotes })

      showToast('Edits saved')
      router.refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', false)
    } finally {
      setSaving(false)
    }
  }

  // â”€â”€ Status actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleAction(action: string, extra?: object) {
    setActing(true)
    try {
      await callAction({ action, ...extra })
      showToast(
        action === 'approve'               ? 'Approved' :
        action === 'reject'                ? 'Rejected' :
        action === 'request_edits'         ? 'Marked: Needs Edits' :
        action === 'mark_ready_to_publish' ? 'Ready to Publish' :
        'Done'
      )
      router.refresh()
      router.push('/content')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed', false)
    } finally {
      setActing(false)
      setShowReject(false)
    }
  }

  // â”€â”€ Generate video â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleGenerateVideo() {
    setRendering(true)
    try {
      const res = await callAction({ action: 'request_video_render' })
      const isStub = res.message?.includes('Stub')
      showToast(isStub ? 'Video generated!' : 'Video render started - check back shortly')
      router.refresh()
      if (isStub) router.push('/content')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Render failed', false)
    } finally {
      setRendering(false)
    }
  }

  // â”€â”€ Delete this item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/queue/${item.id}`, { method: 'DELETE' })
      if (res.ok) {
        // Hard navigate to bust the server component cache
        window.location.href = '/content'
      } else {
        const j = await res.json()
        showToast(j.error ?? 'Delete failed', false)
        setDeleting(false)
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed', false)
      setDeleting(false)
    }
  }

  // â”€â”€ Reset stuck rendering back to approved â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleResetToApproved() {
    try {
      const res = await fetch(`/api/queue/${item.id}/reset-render`, { method: 'POST' })
      if (res.ok) {
        window.location.reload()
      } else {
        const j = await res.json()
        showToast(j.error ?? 'Reset failed', false)
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Reset failed', false)
    }
  }

  const p = item.package

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => router.push('/content')}
              className="text-sm text-gray-400 hover:text-gray-600 transition"
            >
              Back to Queue
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500 truncate max-w-xs">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={effectiveStatus} />
            <span className="text-xs text-gray-400 uppercase">{p.platform}</span>
            <span className="text-xs text-gray-400">
              {generatedAtDisplay ? `Generated ${generatedAtDisplay}` : ''}
            </span>
          </div>
        </div>

        {/* Delete button â€” always available */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete this item"
            className="shrink-0 p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 shrink-0">
            <span className="text-xs text-red-700 font-medium">Delete permanently?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Action buttons */}
        {!isTerminal && !isRendering && (
          <div className="flex gap-2 flex-wrap justify-end">
            {/* Text editing actions â€” available until video_rendering */}
            {(effectiveStatus === 'pending_review' || effectiveStatus === 'needs_edits') && (
              <>
                <Button variant="secondary" loading={saving} onClick={handleSaveEdits}>
                  Save Edits
                </Button>
                <Button
                  variant="secondary"
                  loading={acting}
                  onClick={() => handleAction('request_edits', { notes: reviewNotes || 'Needs review' })}
                >
                  Needs Edits
                </Button>
                <Button variant="primary" loading={acting} onClick={() => handleAction('approve')}>
                  Approve Text
                </Button>
                <Button variant="danger" loading={acting} onClick={() => setShowReject(true)}>
                  Reject
                </Button>
              </>
            )}

                  Skip to Ready
            {effectiveStatus === 'approved' && (
              <>
                <Button variant="secondary" loading={saving} onClick={handleSaveEdits}>
                  Save Edits
                </Button>
                <Button
                  variant="primary"
                  loading={rendering}
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={handleGenerateVideo}
                >
                  Generate Video
                </Button>
                <Button
                  variant="primary"
                  loading={acting}
                  className="bg-indigo-800 hover:bg-indigo-900"
                  onClick={() => handleAction('mark_ready_to_publish')}
                >
                  Skip to Ready
                </Button>
                <Button variant="danger" loading={acting} onClick={() => setShowReject(true)}>
                  Reject
                </Button>
              </>
            )}

                  Mark Ready to Publish
            {effectiveStatus === 'video_ready' && (
              <>
                <Button
                  variant="primary"
                  loading={acting}
                  className="bg-indigo-800 hover:bg-indigo-900"
                  onClick={() => handleAction('mark_ready_to_publish')}
                >
                  Mark Ready to Publish
                </Button>
                <Button
                  variant="secondary"
                  loading={rendering}
                  title="Re-render will replace the current video"
                  onClick={handleGenerateVideo}
                >
                  Re-render Video
                </Button>
                <Button variant="danger" loading={acting} onClick={() => setShowReject(true)}>
                  Reject
                </Button>
              </>
            )}

            {/* ready_to_publish: final confirmation */}
            {effectiveStatus === 'ready_to_publish' && (
              <Button variant="danger" loading={acting} onClick={() => setShowReject(true)}>
                Reject
              </Button>
            )}
          </div>
        )}

        {/* Rendering spinner */}
        {isRendering && (
          <div className="flex items-center gap-2 text-purple-600">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm font-medium">Video rendering...</span>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          toast.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Reject modal */}
      {showReject && (
        <Card className="border border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-800 mb-3">Reject this item?</p>
          <Input
            label="Reason (required)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="e.g. Off-brand tone, factual error..."
          />
          <div className="flex gap-2 mt-3">
            <Button
              variant="danger"
              loading={acting}
              disabled={!rejectReason.trim()}
              onClick={() => handleAction('reject', { reason: rejectReason })}
            >
              Confirm Reject
            </Button>
            <Button variant="secondary" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Terminal state notice */}
      {isTerminal && (
        <Card className="bg-gray-50 border border-gray-200">
          <p className="text-sm text-gray-500">
            This item is <strong>{effectiveStatus}</strong> and cannot be edited.
          </p>
        </Card>
      )}

      {/* Refreshing overlay â€” shown when poll detects video is ready */}
      {refreshing && (
        <div className="fixed inset-0 bg-white/60 flex items-center justify-center z-50 pointer-events-none">
          <div className="flex items-center gap-3 bg-white shadow-lg rounded-xl px-5 py-3">
            <svg className="animate-spin h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Video ready - loading...</span>
          </div>
        </div>
      )}

      {/* Rendering in progress notice */}
      {isRendering && (
        <Card className="bg-purple-50 border border-purple-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-purple-800">Video is being generated</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  TTS voiceover + Pexels clips are being assembled. This page will update automatically.
                </p>
              </div>
            </div>
            <button
              onClick={handleResetToApproved}
              className="shrink-0 text-xs text-purple-500 hover:text-purple-800 underline whitespace-nowrap"
              title="Stuck? Reset back to Approved so you can try again"
            >
              Stuck? Reset
            </button>
          </div>
        </Card>
      )}

      {/* â”€â”€ Video player (shown when video_url is available) â”€â”€ */}
      {hasVideo && effectiveVideoUrl && (
        <Card className="bg-gray-900 border-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Generated Video Preview
          </h3>
          <div className="flex justify-center">
            <video
              src={effectiveVideoUrl}
              controls
              playsInline
              className="rounded-xl max-h-[500px] w-auto"
              style={{ aspectRatio: '9/16', maxWidth: '280px' }}
            >
              Your browser does not support video playback.
            </video>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            Review this video before marking Ready to Publish
          </p>
        </Card>
      )}

      {/* â”€â”€ Editable fields â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Title */}
        <Card>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Title</h3>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={isTerminal}
            placeholder="Video title"
          />
          {title !== p.caption.title && (
            <p className="text-xs text-indigo-500 mt-1">
              Original: <span className="text-gray-500">{p.caption.title}</span>
            </p>
          )}
        </Card>

        {/* Hook */}
        <Card>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Hook</h3>
          <Input
            value={hook}
            onChange={e => setHook(e.target.value)}
            disabled={isTerminal}
            placeholder="Opening hook..."
          />
          {hook !== p.script.hook && (
            <p className="text-xs text-indigo-500 mt-1">
              Original: <span className="text-gray-500">{p.script.hook}</span>
            </p>
          )}
        </Card>

        {/* Script â€” structured segment cards */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Script
              {hasVideo && (
                <span className="ml-2 text-xs text-amber-500 font-normal normal-case">
                  Warning: Editing after video render requires a re-render
                </span>
              )}
            </h3>
            <span className="text-xs text-gray-400">
              {fullScript.trim().split(/\s+/).length} words
            </span>
          </div>

          <div className="space-y-2">
            {/* Hook */}
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-2 text-xs font-semibold text-indigo-500 uppercase w-14 text-right">Hook</span>
              <Input
                value={hook}
                onChange={e => setHook(e.target.value)}
                disabled={isTerminal}
                placeholder="Opening hook..."
                className="flex-1"
              />
            </div>

            {/* Segments */}
            {segments.map((seg, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="shrink-0 mt-2 text-xs font-semibold text-gray-400 w-14 text-right">
                  Fact {i + 1}
                </span>
                <div className="flex-1 flex gap-1">
                  <Input
                    value={seg}
                    onChange={e => {
                      const updated = [...segments]
                      updated[i] = e.target.value
                      setSegments(updated)
                    }}
                    disabled={isTerminal}
                    placeholder={`Segment ${i + 1}...`}
                    className="flex-1"
                  />
                  {!isTerminal && segments.length > 2 && (
                    <button
                      onClick={() => setSegments(segments.filter((_, idx) => idx !== i))}
                      className="shrink-0 px-2 text-gray-300 hover:text-red-400 transition text-sm"
                      title="Remove segment"
                    >x</button>
                  )}
                </div>
              </div>
            ))}

            {/* Add segment */}
            {!isTerminal && segments.length < 5 && (
              <div className="flex items-start gap-2">
                <span className="w-14" />
                <button
                  onClick={() => setSegments([...segments, ''])}
                  className="text-xs text-indigo-400 hover:text-indigo-600 transition py-1"
                >
                  + Add segment
                </button>
              </div>
            )}

            {/* Ending */}
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-2 text-xs font-semibold text-indigo-500 uppercase w-14 text-right">Ending</span>
              <Input
                value={ending}
                onChange={e => setEnding(e.target.value)}
                disabled={isTerminal}
                placeholder="Call to action or punchline..."
                className="flex-1"
              />
            </div>
          </div>

          {/* Assembled preview */}
          <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 font-medium mb-1">Assembled script (sent to TTS):</p>
            <p className="text-xs text-gray-600 leading-relaxed">{fullScript || <em className="text-gray-300">empty</em>}</p>
          </div>

          {fullScript !== p.script.fullScript && (
            <p className="text-xs text-indigo-500 mt-2">Edited from original</p>
          )}
        </Card>

        {/* Caption */}
        <Card>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Caption</h3>
          <Textarea
            value={primaryCaption}
            onChange={e => setPrimaryCaption(e.target.value)}
            disabled={isTerminal}
            className="min-h-[100px]"
            placeholder="Post caption..."
          />
          {primaryCaption !== p.caption.primaryCaption && (
            <p className="text-xs text-indigo-500 mt-1">Edited from original</p>
          )}
          {p.caption.alternativeCaptions?.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-400 font-medium">Alt options:</p>
              {p.caption.alternativeCaptions.map((alt, i) => (
                <button
                  key={i}
                  disabled={isTerminal}
                  onClick={() => setPrimaryCaption(alt)}
                  className="block w-full text-left text-xs text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded px-2 py-1.5 transition"
                >
                  {alt}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Hashtags */}
        <Card>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Hashtags</h3>
          <Textarea
            value={hashtagsRaw}
            onChange={e => setHashtagsRaw(e.target.value)}
            disabled={isTerminal}
            className="min-h-[80px]"
            hint="Comma-separated - e.g. #shorts, #productivity"
            placeholder="#shorts, #productivity..."
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {hashtagsRaw.split(',').map(h => h.trim()).filter(Boolean).map((h, i) => (
              <span key={i} className="text-xs bg-indigo-50 text-indigo-700 rounded px-2 py-0.5">
                {h.startsWith('#') ? h : `#${h}`}
              </span>
            ))}
          </div>
        </Card>

        {/* Review Notes */}
        <Card className="lg:col-span-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Review Notes</h3>
          <Textarea
            value={reviewNotes}
            onChange={e => setReviewNotes(e.target.value)}
            disabled={isTerminal}
            placeholder="Internal notes for this item..."
            hint="Not published - for your reference only"
          />
        </Card>
      </div>

      {/* â”€â”€ Read-only: Original AI outputs â”€â”€ */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Original AI Output (read-only)
        </h2>

        {/* Strategy */}
        <Card>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Strategy</h3>
          <div className="space-y-2 text-sm">
            <Row label="Theme"       value={p.strategy.theme} />
            <Row label="Angle"       value={p.strategy.angle} />
            <Row label="Emotion"     value={p.strategy.targetEmotion} />
            <Row label="Positioning" value={p.strategy.positioning} />
            <div>
              <span className="font-medium text-gray-600">Talking points:</span>
              <ul className="mt-1 list-disc list-inside text-gray-500 space-y-0.5">
                {p.strategy.talkingPoints.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          </div>
        </Card>

        {/* Media plan */}
        <Card>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Media Plan - {p.media.scenes.length} scenes
          </h3>
          <div className="space-y-3">
            {p.media.scenes.map(scene => (
              <div key={scene.sceneNumber} className="bg-gray-50 rounded-xl p-3 text-sm">
                <p className="font-medium text-gray-700 mb-1">Scene {scene.sceneNumber}</p>
                <p className="text-xs text-gray-500 italic mb-2">"{scene.scriptSegment}"</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <Row label="Visual" value={scene.visualDescription} />
                  <Row label="Camera" value={scene.cameraDirection} />
                  <Row label="Edit"   value={scene.editingNote} />
                  <Row label="Asset"  value={scene.assetGuidance} />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
              <Row label="Style"     value={p.media.overallStyle} />
              <Row label="Colour"    value={p.media.colorGrading} />
              <Row label="Music"     value={p.media.musicMood} />
              <Row label="Thumbnail" value={p.media.thumbnailConcept} />
            </div>
          </div>
        </Card>

        {/* CTA variations */}
        {p.caption.ctaVariations?.length > 0 && (
          <Card>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">CTA Variations</h3>
            <ul className="space-y-1">
              {p.caption.ctaVariations.map((cta, i) => (
                <li key={i} className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5">{cta}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-gray-600">{label}: </span>
      <span className="text-gray-500">{value}</span>
    </div>
  )
}






