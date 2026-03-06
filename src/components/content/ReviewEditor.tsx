'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContentQueueItemFull } from '@/types/content'
import { ReviewEdits } from '@/types/agents'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import StatusBadge from '@/components/ui/StatusBadge'

// ── Merge helper ──────────────────────────────────────────────────────────────
// Merges the immutable package with any human overrides in review_edits.
// The original package is never modified — this is display-only merging.
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
    reviewNotes:    e.reviewNotes    ?? item.review_notes ?? '',
  }
}

export default function ReviewEditor({ item }: { item: ContentQueueItemFull }) {
  const router = useRouter()
  const merged = mergeWithEdits(item)

  // Local edit state — starts from merged (package + any existing edits)
  const [title, setTitle]               = useState(merged.title)
  const [hook, setHook]                 = useState(merged.hook)
  const [fullScript, setFullScript]     = useState(merged.fullScript)
  const [primaryCaption, setPrimaryCaption] = useState(merged.primaryCaption)
  const [hashtagsRaw, setHashtagsRaw]   = useState(merged.hashtags.join(', '))
  const [reviewNotes, setReviewNotes]   = useState(merged.reviewNotes)
  const [rejectReason, setRejectReason] = useState('')

  const [saving, setSaving]   = useState(false)
  const [acting, setActing]   = useState(false)
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [showReject, setShowReject] = useState(false)

  const isTerminal = item.status === 'rejected' || item.status === 'published'

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── API call helper ──────────────────────────────────────────────────────
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

  // ── Save edits ───────────────────────────────────────────────────────────
  async function handleSaveEdits() {
    setSaving(true)
    try {
      const edits: ReviewEdits = {}
      if (title !== item.package.caption.title)               edits.title = title
      if (hook !== item.package.script.hook)                  edits.hook = hook
      if (fullScript !== item.package.script.fullScript)      edits.fullScript = fullScript
      if (primaryCaption !== item.package.caption.primaryCaption) edits.primaryCaption = primaryCaption
      const hashtags = hashtagsRaw.split(',').map(h => h.trim()).filter(Boolean)
      if (JSON.stringify(hashtags) !== JSON.stringify(item.package.caption.hashtags)) edits.hashtags = hashtags
      if (reviewNotes !== (item.review_notes ?? ''))           edits.reviewNotes = reviewNotes

      await callAction({ action: 'save_edits', edits })
      showToast('Edits saved')
      router.refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', false)
    } finally {
      setSaving(false)
    }
  }

  // ── Status actions ───────────────────────────────────────────────────────
  async function handleAction(action: string, extra?: object) {
    setActing(true)
    try {
      await callAction({ action, ...extra })
      showToast(
        action === 'approve'              ? 'Approved ✓' :
        action === 'reject'               ? 'Rejected' :
        action === 'request_edits'        ? 'Marked: Needs Edits' :
        action === 'mark_ready_to_publish' ? 'Marked: Ready to Publish ✓' :
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
              ← Queue
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500 truncate max-w-xs">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="text-xs text-gray-400 uppercase">{p.platform}</span>
            <span className="text-xs text-gray-400">
              Generated {new Date(p.generatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action buttons — disabled for terminal states */}
        {!isTerminal && (
          <div className="flex gap-2 flex-wrap justify-end">
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
            <Button
              variant="primary"
              loading={acting}
              onClick={() => handleAction('approve')}
            >
              Approve
            </Button>
            <Button
              variant="primary"
              loading={acting}
              className="bg-indigo-800 hover:bg-indigo-900"
              onClick={() => handleAction('mark_ready_to_publish')}
            >
              Ready to Publish
            </Button>
            <Button
              variant="danger"
              loading={acting}
              onClick={() => setShowReject(true)}
            >
              Reject
            </Button>
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

      {/* Read-only notice for terminal states */}
      {isTerminal && (
        <Card className="bg-gray-50 border border-gray-200">
          <p className="text-sm text-gray-500">
            This item is <strong>{item.status}</strong> and cannot be edited.
          </p>
        </Card>
      )}

      {/* ── Editable fields ── */}
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

        {/* Script */}
        <Card className="lg:col-span-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Full Script</h3>
          <Textarea
            value={fullScript}
            onChange={e => setFullScript(e.target.value)}
            disabled={isTerminal}
            className="min-h-[140px]"
            placeholder="Full script..."
          />
          {fullScript !== p.script.fullScript && (
            <p className="text-xs text-indigo-500 mt-1">Edited from original</p>
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
          {/* Alternative captions for reference */}
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
            hint="Comma-separated — e.g. #shorts, #productivity"
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
            hint="Not published — for your reference only"
          />
        </Card>
      </div>

      {/* ── Read-only: AI outputs ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Original AI Output (read-only)
        </h2>

        {/* Strategy */}
        <Card>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Strategy</h3>
          <div className="space-y-2 text-sm">
            <Row label="Theme"     value={p.strategy.theme} />
            <Row label="Angle"     value={p.strategy.angle} />
            <Row label="Emotion"   value={p.strategy.targetEmotion} />
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
            Media Plan — {p.media.scenes.length} scenes
          </h3>
          <div className="space-y-3">
            {p.media.scenes.map(scene => (
              <div key={scene.sceneNumber} className="bg-gray-50 rounded-xl p-3 text-sm">
                <p className="font-medium text-gray-700 mb-1">Scene {scene.sceneNumber}</p>
                <p className="text-xs text-gray-500 italic mb-2">"{scene.scriptSegment}"</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <Row label="Visual"   value={scene.visualDescription} />
                  <Row label="Camera"   value={scene.cameraDirection} />
                  <Row label="Edit"     value={scene.editingNote} />
                  <Row label="Asset"    value={scene.assetGuidance} />
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

// Small read-only label/value pair
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-gray-600">{label}: </span>
      <span className="text-gray-500">{value}</span>
    </div>
  )
}
