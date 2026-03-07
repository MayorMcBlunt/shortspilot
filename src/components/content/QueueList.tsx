'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ContentQueueRow } from '@/types/content'
import { ReviewStatus } from '@/types/agents'
import StatusBadge from '@/components/ui/StatusBadge'
import { VALID_REVIEW_STATUSES } from '@/lib/validation'

const ALL = 'all' as const
type Filter = ReviewStatus | typeof ALL

const FILTER_LABELS: Record<Filter, string> = {
  all:              'All',
  pending_review:   'Pending',
  needs_edits:      'Needs Edits',
  approved:         'Approved',
  video_rendering:  'Rendering',
  video_ready:      'Video Ready',
  ready_to_publish: 'Ready',
  rejected:         'Rejected',
  published:        'Published',
}

const FILTERS: Filter[] = [ALL, ...VALID_REVIEW_STATUSES]

const stableDate = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date(iso))

export default function QueueList({ initialItems }: { initialItems: ContentQueueRow[] }) {
  const router = useRouter()

  // â”€â”€ Local copy of items â€” optimistically updated on delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [items, setItems]             = useState<ContentQueueRow[]>(initialItems)
  const [filter, setFilter]           = useState<Filter>(ALL)
  const [selectMode, setSelectMode]   = useState(false)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [deleting, setDeleting]       = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)

  const visible = filter === ALL
    ? items
    : items.filter(i => i.status === filter)

  // â”€â”€ Select helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === visible.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visible.map(i => i.id)))
    }
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
    setConfirmBulk(false)
  }

  // â”€â”€ Optimistic removal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function removeItems(ids: string[]) {
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
  }

  // â”€â”€ Single delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleDeleteOne(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this item? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/queue/${id}`, { method: 'DELETE' })
      if (res.ok) {
        const j = await res.json()
        const deletedIds = Array.isArray(j.deletedIds) ? j.deletedIds : [id]
        removeItems(deletedIds)
        router.refresh()
      } else {
        const j = await res.json()
        alert(j.error ?? 'Delete failed')
      }
    } finally {
      setDeleting(false)
    }
  }

  // â”€â”€ Bulk delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleBulkDelete() {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    setDeleting(true)
    setConfirmBulk(false)
    try {
      const res = await fetch('/api/queue/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (res.ok) {
        const j = await res.json()
        const deletedIds = Array.isArray(j.deletedIds) ? j.deletedIds : ids
        removeItems(deletedIds)
        exitSelectMode()
        router.refresh()
      } else {
        const j = await res.json()
        alert(j.error ?? 'Bulk delete failed')
      }
    } finally {
      setDeleting(false)
    }
  }

  const allVisibleSelected = visible.length > 0 && selected.size === visible.length

  return (
    <div>
      {/* â”€â”€ Top bar â”€â”€ */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {FILTER_LABELS[f]}
              {f !== ALL && (
                <span className="ml-1 opacity-70">
                  ({items.filter(i => i.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {items.length > 0 && (
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              selectMode
                ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                : 'border-red-200 text-red-600 hover:bg-red-50'
            }`}
          >
            {selectMode ? 'âœ• Cancel' : 'ðŸ—‘ Manage'}
          </button>
        )}
      </div>

      {/* â”€â”€ Bulk action bar â”€â”€ */}
      {selectMode && (
        <div className="flex items-center justify-between bg-gray-900 text-white rounded-xl px-4 py-3 mb-4 gap-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
            />
            <span className="text-sm">
              {selected.size === 0
                ? 'Select items to delete'
                : `${selected.size} item${selected.size !== 1 ? 's' : ''} selected`}
            </span>
          </div>

          {selected.size > 0 && (
            confirmBulk ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-300">
                  Delete {selected.size} item{selected.size !== 1 ? 's' : ''}? Cannot be undone.
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirmBulk(false)}
                  className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmBulk(true)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition disabled:opacity-50"
              >
                ðŸ—‘ Delete Selected ({selected.size})
              </button>
            )
          )}
        </div>
      )}

      {/* â”€â”€ Empty state â”€â”€ */}
      {visible.length === 0 && (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-gray-400 text-sm">No items match this filter.</p>
        </div>
      )}

      {/* â”€â”€ List â”€â”€ */}
      <div className="space-y-3">
        {visible.map(item => (
          <div
            key={item.id}
            className={`flex items-stretch rounded-2xl shadow transition ${
              selectMode && selected.has(item.id)
                ? 'ring-2 ring-red-400'
                : 'hover:shadow-md'
            }`}
          >
            {/* Checkbox (select mode) */}
            {selectMode && (
              <button
                onClick={() => toggleSelect(item.id)}
                className="flex items-center justify-center w-12 shrink-0 bg-white rounded-l-2xl border-r border-gray-100 hover:bg-red-50 transition"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  onClick={e => e.stopPropagation()}
                  className="w-4 h-4 rounded accent-red-500 pointer-events-none"
                />
              </button>
            )}

            {/* Card body */}
            <Link
              href={selectMode ? '#' : `/content/${item.id}`}
              onClick={selectMode ? (e) => { e.preventDefault(); toggleSelect(item.id) } : undefined}
              className={`flex-1 bg-white px-6 py-4 group ${
                selectMode ? 'cursor-pointer rounded-r-2xl' : 'rounded-2xl hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-gray-400 uppercase tracking-wide">{item.platform}</span>
                  </div>
                  <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition">
                    {item.review_edits?.title ?? item.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                    {item.review_edits?.hook ?? item.hook}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 mt-1">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {stableDate(item.created_at)}
                  </span>
                  {!selectMode && (
                    <button
                      onClick={(e) => handleDeleteOne(item.id, e)}
                      disabled={deleting}
                      title="Delete this item"
                      className="opacity-0 group-hover:opacity-100 transition text-gray-300 hover:text-red-500 p-1 rounded"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {item.review_notes && (
                <p className="mt-2 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 line-clamp-1">
                  ðŸ“ {item.review_notes}
                </p>
              )}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}


