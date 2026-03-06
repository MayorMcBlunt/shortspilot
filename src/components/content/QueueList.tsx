'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  ready_to_publish: 'Ready',
  rejected:         'Rejected',
  published:        'Published',
}

const FILTERS: Filter[] = [ALL, ...VALID_REVIEW_STATUSES]

export default function QueueList({ initialItems }: { initialItems: ContentQueueRow[] }) {
  const [filter, setFilter] = useState<Filter>(ALL)

  const visible = filter === ALL
    ? initialItems
    : initialItems.filter(i => i.status === filter)

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
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
                ({initialItems.filter(i => i.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-gray-400 text-sm">No items match this filter.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {visible.map(item => (
          <Link
            key={item.id}
            href={`/content/${item.id}`}
            className="block bg-white rounded-2xl shadow px-6 py-4 hover:shadow-md transition group"
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
              <div className="text-xs text-gray-400 whitespace-nowrap shrink-0 mt-1">
                {new Date(item.created_at).toLocaleDateString()}
              </div>
            </div>
            {item.review_notes && (
              <p className="mt-2 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 line-clamp-1">
                📝 {item.review_notes}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
