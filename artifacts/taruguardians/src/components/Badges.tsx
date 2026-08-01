import { type ContentType, type TaskStatus } from '../lib/supabase'
import { Video, Mic, FileText, CheckCircle2, Bot, AlertTriangle, Clock } from 'lucide-react'

export function ContentTypeBadge({ type }: { type: ContentType }) {
  const map = {
    gd: { label: 'GD', icon: Mic, color: 'text-gold bg-gold/10 border-gold/30' },
    video: { label: 'Video', icon: Video, color: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
    post: { label: 'Post', icon: FileText, color: 'text-emerald2 bg-emerald2/10 border-emerald2/30' },
  }
  const m = map[type]
  const Icon = m.icon
  return (
    <span className={`badge border ${m.color}`}>
      <Icon size={12} />
      {m.label}
    </span>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; icon: typeof Clock; color: string }> = {
    pending: { label: 'Pending', icon: Clock, color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
    submitted: { label: 'Submitted', icon: CheckCircle2, color: 'text-emerald2 bg-emerald2/10 border-emerald2/30' },
    ai_generated: { label: 'AI-Generated', icon: Bot, color: 'text-gold bg-gold/10 border-gold/30' },
    overdue: { label: 'Overdue', icon: AlertTriangle, color: 'text-crimson bg-crimson/10 border-crimson/30' },
  }
  const m = map[status]
  const Icon = m.icon
  return (
    <span className={`badge border ${m.color}`}>
      <Icon size={12} />
      {m.label}
    </span>
  )
}

export function AITag() {
  return (
    <span className="badge border border-gold/30 bg-gold/10 text-gold">
      <Bot size={12} />
      AI-Generated
    </span>
  )
}
