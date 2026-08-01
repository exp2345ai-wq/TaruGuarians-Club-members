import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, type ScheduleEntry, type Profile, type ContentType } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { ContentTypeBadge } from '../components/Badges'
import { Modal, Spinner, EmptyState } from '../components/ui'
import { format, formatDistanceToNow } from 'date-fns'
import { CalendarDays, Plus, Clock, Trash2, Lock } from 'lucide-react'

export default function Schedule() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      let q = supabase.from('schedule').select('*').order('due_date', { ascending: true })
      if (!isAdmin) q = q.eq('member_id', profile.id)
      const { data } = await q
      if (data) setEntries(data as ScheduleEntry[])
      if (isAdmin) {
        const { data: m } = await supabase.from('profiles').select('*').eq('onboarded', true)
        if (m) setMembers(m as Profile[])
      }
      setLoading(false)
    }
    load()
  }, [profile, isAdmin])

  const nameFor = (id: string) => members.find((m) => m.id === id)?.full_name || 'Member'

  const remove = async (id: string) => {
    await supabase.from('schedule').delete().eq('id', id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
            Monthly <span className="text-gold glow-text">Schedule</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isAdmin ? 'Upload the monthly content plan and track everyone.' : 'Your assigned content for the month. Only you can see this.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" className="input w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
          {isAdmin && <button onClick={() => setAddOpen(true)} className="btn-gold"><Plus size={18} /> Add Entry</button>}
        </div>
      </div>

      {!isAdmin && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/[0.06] px-4 py-2 text-xs text-gold">
          <Lock size={13} /> Your schedule is private — only you can see your assignments.
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-24"><Spinner size={32} /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={<CalendarDays size={40} />} title="No schedule yet" subtitle={isAdmin ? 'Add entries to build the monthly plan.' : 'No assignments for this month.'} action={isAdmin ? <button onClick={() => setAddOpen(true)} className="btn-gold"><Plus size={18} /> Add Entry</button> : undefined} />
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const due = new Date(e.due_date)
            const soon = due.getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000 && due > new Date()
            return (
              <div key={e.id} className={`card p-5 animate-fade-in ${soon ? 'border-gold/30' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <ContentTypeBadge type={e.content_type} />
                      {soon && <span className="badge border border-gold/30 bg-gold/10 text-gold"><Clock size={11} /> Due soon</span>}
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-100">{e.topic}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {isAdmin && <span>Member: <span className="text-slate-300">{nameFor(e.member_id)}</span></span>}
                      <span className={soon ? 'text-gold' : ''}>
                        <Clock size={11} className="mr-1 inline" />
                        Due {format(due, 'd MMM yyyy')} ({formatDistanceToNow(due, { addSuffix: true })})
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => remove(e.id)} className="text-slate-600 transition hover:text-crimson"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Schedule Entry" maxWidth="max-w-lg">
        <ScheduleForm members={members} defaultMonth={month} onDone={() => { setAddOpen(false); window.location.reload() }} />
      </Modal>
    </Layout>
  )
}

function ScheduleForm({ members, defaultMonth, onDone }: { members: Profile[]; defaultMonth: string; onDone: () => void }) {
  const [memberId, setMemberId] = useState('')
  const [topic, setTopic] = useState('')
  const [contentType, setContentType] = useState<ContentType>('gd')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberId) { setError('Pick a member.'); return }
    if (!topic.trim()) { setError('Topic is required.'); return }
    if (!dueDate) { setError('Due date is required.'); return }
    setSaving(true)
    setError(null)
    const dd = new Date(dueDate).toISOString()
    const { error: insErr } = await supabase.from('schedule').insert({
      member_id: memberId,
      topic: topic.trim(),
      content_type: contentType,
      due_date: dd,
      month: defaultMonth,
    })
    if (insErr) { setError(insErr.message); setSaving(false); return }
    await supabase.from('notifications').insert({
      user_id: memberId,
      type: 'task_assigned',
      message: `New schedule entry: "${topic.trim()}" due ${format(new Date(dd), 'd MMM yyyy')}.`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label">Member</label>
        <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">Select a member…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Topic</label>
        <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Teamwork GD" />
      </div>
      <div>
        <label className="label">Content Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['gd', 'video', 'post'] as ContentType[]).map((t) => (
            <button key={t} type="button" onClick={() => setContentType(t)}
              className={`rounded-md border px-3 py-2.5 text-sm font-semibold uppercase transition ${contentType === t ? 'border-gold/50 bg-gold/10 text-gold' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Due Date</label>
        <input type="datetime-local" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      {error && <p className="rounded-md border border-crimson/30 bg-crimson/10 px-4 py-2.5 text-sm text-crimson">{error}</p>}
      <button type="submit" disabled={saving} className="btn-gold w-full py-3">
        {saving ? <Spinner size={18} /> : <Plus size={18} />} {saving ? 'Saving…' : 'Add to Schedule'}
      </button>
    </form>
  )
}
