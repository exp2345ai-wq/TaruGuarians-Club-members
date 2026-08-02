import { useEffect, useState } from 'react'
import { supabase, type Profile, type Task, type ScheduleEntry, type Content } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { ContentTypeBadge, TaskStatusBadge } from '../components/Badges'
import { Spinner, EmptyState } from '../components/ui'
import { format } from 'date-fns'
import { Users, ListChecks, CalendarDays, TriangleAlert as AlertTriangle, Bot, Zap, Send } from 'lucide-react'

export default function Admin() {
  const [members, setMembers] = useState<Profile[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [content, setContent] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [aiRunning, setAiRunning] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [reminderRunning, setReminderRunning] = useState(false)
  const [reminderResult, setReminderResult] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: m }, { data: t }, { data: s }, { data: c }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('tasks').select('*').order('deadline', { ascending: true }),
        supabase.from('schedule').select('*').order('due_date', { ascending: true }),
        supabase.from('content').select('*').order('created_at', { ascending: false }),
      ])
      if (m) setMembers(m as Profile[])
      if (t) setTasks(t as Task[])
      if (s) setSchedule(s as ScheduleEntry[])
      if (c) setContent(c as Content[])
      setLoading(false)
    }
    load()
  }, [])

  const nameFor = (id: string) => members.find((m) => m.id === id)?.full_name || members.find((m) => m.id === id)?.email || 'Unknown'

  const pendingTasks = tasks.filter((t) => t.status === 'pending')
  const overdueTasks = tasks.filter((t) => new Date(t.deadline) < new Date() && t.status === 'pending')
  const aiTasks = tasks.filter((t) => t.status === 'ai_generated')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

  const runAiFallback = async () => {
    setAiRunning(true)
    setAiResult(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-fallback`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setAiResult(`Done — checked ${data.checked ?? 0} items, generated ${data.generated ?? 0} new content.`)
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setAiResult(`Error: ${data.error ?? 'Unknown error'}`)
      }
    } catch (e) {
      setAiResult(`Error: ${(e as Error).message}`)
    }
    setAiRunning(false)
  }

  const runReminders = async () => {
    setReminderRunning(true)
    setReminderResult(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/schedule-reminders`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setReminderResult(`Done — ${data.sent ?? 0} reminders sent.`)
      } else {
        setReminderResult(`Error: ${data.error ?? 'Unknown error'}`)
      }
    } catch (e) {
      setReminderResult(`Error: ${(e as Error).message}`)
    }
    setReminderRunning(false)
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
          Admin <span className="text-gold glow-text">Overview</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">Full visibility across the guild — members, tasks, schedule, and content.</p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-24"><Spinner size={32} /></div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="Members" value={members.length} color="text-gold" />
            <StatCard icon={ListChecks} label="Pending Tasks" value={pendingTasks.length} color="text-amber-300" />
            <StatCard icon={AlertTriangle} label="Overdue" value={overdueTasks.length} color="text-crimson" />
            <StatCard icon={Bot} label="AI-Generated" value={aiTasks.length} color="text-gold" />
          </div>

          {/* AI Fallback & Reminder Triggers */}
          <div className="mb-8 flex flex-wrap gap-3">
            <button onClick={runAiFallback} disabled={aiRunning} className="btn-gold">
              {aiRunning ? <Spinner size={16} /> : <Zap size={16} />} {aiRunning ? 'Running AI…' : 'Run AI Fallback'}
            </button>
            <button onClick={runReminders} disabled={reminderRunning} className="btn-ghost">
              {reminderRunning ? <Spinner size={16} /> : <Send size={16} />} {reminderRunning ? 'Sending…' : 'Send Reminders'}
            </button>
          </div>
          {aiResult && <p className="mb-4 text-sm text-gold">{aiResult}</p>}
          {reminderResult && <p className="mb-4 text-sm text-slate-300">{reminderResult}</p>}

          {overdueTasks.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-crimson">
                <AlertTriangle size={18} /> Needs Follow-up ({overdueTasks.length})
              </h2>
              <div className="space-y-2">
                {overdueTasks.map((t) => (
                  <div key={t.id} className="card border-crimson/30 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-100">{t.topic}</p>
                        <p className="text-xs text-slate-500">For {nameFor(t.assigned_to)} · Due {format(new Date(t.deadline), 'd MMM')}</p>
                      </div>
                      <TaskStatusBadge status="overdue" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-white">
              <ListChecks size={18} /> All Tasks
            </h2>
            {tasks.length === 0 ? (
              <EmptyState icon={<ListChecks size={32} />} title="No tasks assigned yet" />
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Topic</th>
                      <th className="px-4 py-3">For</th>
                      <th className="hidden px-4 py-3 sm:table-cell">Type</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id} className="border-b border-white/[0.03] last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-200">{t.topic}</td>
                        <td className="px-4 py-3 text-slate-400">{nameFor(t.assigned_to)}</td>
                        <td className="hidden px-4 py-3 sm:table-cell"><ContentTypeBadge type={t.content_type} /></td>
                        <td className="px-4 py-3 text-slate-400">{format(new Date(t.deadline), 'd MMM')}</td>
                        <td className="px-4 py-3"><TaskStatusBadge status={t.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-white">
              <CalendarDays size={18} /> Schedule Overview
            </h2>
            {schedule.length === 0 ? (
              <EmptyState icon={<CalendarDays size={32} />} title="No schedule entries" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {schedule.map((e) => (
                  <div key={e.id} className="card p-4">
                    <ContentTypeBadge type={e.content_type} />
                    <p className="mt-2 font-display text-sm font-bold text-slate-100">{e.topic}</p>
                    <p className="mt-1 text-xs text-slate-500">{nameFor(e.member_id)} · Due {format(new Date(e.due_date), 'd MMM')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number; color: string }) {
  return (
    <div className="card p-5">
      <Icon size={20} className={color} />
      <p className="mt-3 font-display text-3xl font-extrabold text-white">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  )
}
