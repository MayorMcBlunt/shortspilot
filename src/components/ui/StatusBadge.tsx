import { ReviewStatus } from '@/types/agents'

const config: Record<ReviewStatus, { label: string; classes: string }> = {
  pending_review:    { label: 'Pending Review',    classes: 'bg-yellow-100 text-yellow-800' },
  needs_edits:       { label: 'Needs Edits',       classes: 'bg-orange-100 text-orange-800' },
  approved:          { label: 'Approved',          classes: 'bg-green-100 text-green-800' },
  video_rendering:   { label: 'Rendering Video',   classes: 'bg-purple-100 text-purple-800' },
  video_ready:       { label: 'Video Ready',       classes: 'bg-teal-100 text-teal-800' },
  ready_to_publish:  { label: 'Ready to Publish',  classes: 'bg-indigo-100 text-indigo-800' },
  rejected:          { label: 'Rejected',          classes: 'bg-red-100 text-red-800' },
  published:         { label: 'Published',         classes: 'bg-gray-100 text-gray-600' },
}

export default function StatusBadge({ status }: { status: ReviewStatus }) {
  const { label, classes } = config[status] ?? config.pending_review
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}
