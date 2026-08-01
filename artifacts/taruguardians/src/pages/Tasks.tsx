import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, type Task, type Profile, type ContentType, type TaskStatus } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { ContentTypeBadge, TaskStatusBadge } from '../components/Badges'
import { Modal, Spinner, EmptyState } from '../components/ui'
import { format, formatDistanceToNow } from 'date-fns'
import { ListChecks, Plus, Clock, AlertTriangle, Send } from 'lucide-react'

export default function Tasks() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [assignOpen, setAssignOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'mine' | 'assigned'>('mine')

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .order('deadline', { ascending: true })
      if (data) setTasks(data as Task[])
      const { data: m } = await supabase.from('profiles').select('*').eq('onboarded', true)
      if (m) setMembers(m as Profile[])
      setLoading(false)
    }
    load()
  }, [profile])

  const visible = tasks.filter((t) => {
    if (filter === 'mine') return t.assigned_to === profile?.id
    if (filter === 'assigned') return t.assigned_by === profile?.id
    return true
  })

  const nameFor = (id: string) => members.find((m) => m.id === id)?.full_name || members.find((m) => m.id === id)?.email || 'Unknown'

  const markSubmitted = async (taskId: string) => {
    await supabase.from('tasks').update({ status: 'submitted' }).eq('id', taskId)
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'submitted' } : t)))
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
            <span className="text-gold glow-text">Tasks</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Assign work, track deadlines, and let the AI safety-net catch misses.</p>
        </div>
        <button onClick={() => setAssignOpen(true)} className="btn-gold">
          <Plus size={18} /> Assign Task
        </button>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-white/10 bg-white/[0.02] p-1">
        {(['mine', 'assigned', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition ${
              filter === f ? 'bg-gold/15 text-gold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {f === 'mine' ? 'Assigned to me' : f === 'assigned' ? 'I assigned' : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-24"><Spinner size={32} /></div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<ListChecks size={40} />} title="No tasks here" subtitle="Assign a task to a member to get started." action={<button onClick={() => setAssignOpen(true)} className="btn-gold"><Plus size={18} /> Assign Task</button>} />
      ) : (
        <div className="space-y-3">
          {visible.map((t) => {
            const due = new Date(t.deadline)
            const overdue = due < new Date() && t.status === 'pending'
            return (
              <div key={t.id} className={`card p-5 animate-fade-in ${overdue ? 'border-crimson/30' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <ContentTypeBadge type={t.content_type} />
                      <TaskStatusBadge status={overdue ? 'overdue' : t.status} />
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-100">{t.topic}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>For: <span className="text-slate-300">{nameFor(t.assigned_to)}</span></span>
                      <span>From: <span className="text-slate-300">{nameFor(t.assigned_by)}</span></span>
                      <span className={overdue ? 'text-crimson' : ''}>
                        <Clock size={11} className="mr-1 inline" />
                        Due {format(due, 'd MMM yyyy, HH:mm')} ({formatDistanceToNow(due, { addSuffix: true })})
                      </span>
                    </div>
                  </div>
                  {t.assigned_to === profile?.id && t.status === 'pending' && (
                    <button onClick={() => markSubmitted(t.id)} className="btn-ghost text-sm">
                      <Send size={14} /> Mark submitted
                    </button>
                  )}
                  {t.status === 'ai_generated' && (
                    <div className="flex items-center gap-2 text-xs text-gold">
                      <AlertTriangle size={14} /> AI fallback generated this content
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign a Task" maxWidth="max-w-lg">
        <AssignForm members={members} onDone={() => { setAssignOpen(false); window.location.reload() }} />
      </Modal>
    </Layout>
  )
}

function AssignForm({ members, onDone }: { members: Profile[]; onDone: () => void }) {
  const { profile } = useAuth()
  const [assigneeId, setAssigneeId] = useState('')
  const [topic, setTopic] = useState('')
  const [contentType, setContentType] = useState<ContentType>('gd')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (!assigneeId) { setError('Pick a member to assign.'); return }
    if (!topic.trim()) { setError('Topic is required.'); return }
    if (!deadline) { setError('Deadline is required.'); return }
    setSaving(true)
    setError(null)
    const dl = new Date(deadline).toISOString()
    const { data, error: insErr } = await supabase
      .from('tasks')
      .insert({
        assigned_to: assigneeId,
        assigned_by: profile.id,
        topic: topic.trim(),
        content_type: contentType,
        deadline: dl,
        status: 'pending',
      })
      .select('*')
      .maybeSingle()
    if (insErr) { setError(insErr.message); setSaving(false); return }
    if (data) {
      await supabase.from('notifications').insert({
        user_id: assigneeId,
        type: 'task_assigned',
        message: `You've been assigned: "${topic.trim()}". Due ${format(new Date(dl), 'd MMM yyyy')}.`,
      })
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label">Assign to</label>
        <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Select a member…</option>
          {members.filter((m) => m.id !== profile?.id).map((m) => (
            <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Topic</label>
        <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Public Speaking GD" />
      </div>
      <div>
        <label className="label">Content Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['gd', 'video', 'post'] as ContentType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setContentType(t)}
              className={`rounded-md border px-3 py-2.5 text-sm font-semibold uppercase transition ${contentType === t ? 'border-gold/50 bg-gold/10 text-gold' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Deadline</label>
        <input type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      {error && <p className="rounded-md border border-crimson/30 bg-crimson/10 px-4 py-2.5 text-sm text-crimson">{error}</p>}
      <button type="submit" disabled={saving} className="btn-gold w-full py-3">
        {saving ? <Spinner size={18} /> : <Send size={18} />} {saving ? 'Assigning…' : 'Assign & Notify'}
      </button>
    </form>
  )
}
