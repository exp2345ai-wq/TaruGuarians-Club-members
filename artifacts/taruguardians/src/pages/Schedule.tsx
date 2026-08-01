import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, type ScheduleEntry, type Profile, type ContentType } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { Modal, Spinner, EmptyState } from '../components/ui'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, parseISO, isSameDay, isSameMonth } from 'date-fns'
import { CalendarDays, Upload, Trash2, Lock, FileText, X, Save, Bot } from 'lucide-react'

type ExtractedEntry = {
  date: string
  topic: string
  contentType: ContentType
  memberId: string
}

export default function Schedule() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date())
  const [uploadOpen, setUploadOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!profile) return
    const monthStr = format(month, 'yyyy-MM')
    let q = supabase.from('schedule').select('*').eq('month', monthStr).order('due_date', { ascending: true })
    if (!isAdmin) q = q.eq('member_id', profile.id)
    const { data } = await q
    if (data) setEntries(data as ScheduleEntry[])
    if (isAdmin) {
      const { data: m } = await supabase.from('profiles').select('*').eq('onboarded', true)
      if (m) setMembers(m as Profile[])
    }
    setLoading(false)
  }, [profile, isAdmin, month])

  useEffect(() => { load() }, [load])

  const nameFor = (id: string) => members.find((m) => m.id === id)?.full_name || 'Member'

  const remove = async (id: string) => {
    await supabase.from('schedule').delete().eq('id', id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const firstDayOfWeek = startOfMonth(month).getDay()

  const entriesForDay = (day: Date) =>
    entries.filter((e) => isSameDay(parseISO(e.due_date), day))

  const columns: { type: ContentType; label: string; color: string }[] = [
    { type: 'post', label: 'Post', color: 'text-emerald2' },
    { type: 'video', label: 'Video', color: 'text-sky-300' },
    { type: 'gd', label: 'GD', color: 'text-gold' },
  ]

  return (
    <Layout>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
            Monthly <span className="text-gold glow-text">Schedule</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isAdmin ? 'Upload the monthly content plan as a PDF, assign members, and track everyone.' : 'Your assigned content for the month. Only you can see your assignments.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="btn-ghost px-3 py-2 text-sm"
            >
              ← Prev
            </button>
            <span className="min-w-[8rem] text-center font-display text-lg font-bold text-white">
              {format(month, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="btn-ghost px-3 py-2 text-sm"
            >
              Next →
            </button>
          </div>
          {isAdmin && (
            <>
              <button onClick={() => setUploadOpen(true)} className="btn-gold">
                <Upload size={18} /> Upload PDF
              </button>
              <button onClick={() => setAssignOpen(true)} className="btn-ghost">
                <CalendarDays size={18} /> Add Entry
              </button>
            </>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/[0.06] px-4 py-2 text-xs text-gold">
          <Lock size={13} /> Your schedule is private — only you can see your assignments.
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-24"><Spinner size={32} /></div>
      ) : entries.length === 0 && !isAdmin ? (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="No assignments yet"
          subtitle="No schedule entries for this month."
        />
      ) : (
        <div className="card overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[60px_repeat(3,1fr)] border-b border-white/[0.06] bg-white/[0.02]">
            <div className="px-2 py-3 text-center text-xs font-bold uppercase text-slate-500">Date</div>
            {columns.map((col) => (
              <div key={col.type} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                <span className={col.color}>{col.label}</span>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="divide-y divide-white/[0.04]">
            {days.map((day) => {
              const dayEntries = entriesForDay(day)
              const isToday = isSameDay(day, new Date())
              return (
                <div
                  key={day.toISOString()}
                  className={`grid grid-cols-[60px_repeat(3,1fr)] min-h-[80px] ${isToday ? 'bg-gold/[0.03]' : ''}`}
                >
                  <div className="flex flex-col items-center justify-center border-r border-white/[0.04] py-2">
                    <span className={`text-lg font-bold ${isToday ? 'text-gold' : 'text-slate-300'}`}>
                      {format(day, 'd')}
                    </span>
                    <span className="text-[10px] uppercase text-slate-600">{format(day, 'EEE')}</span>
                  </div>
                  {columns.map((col) => {
                    const colEntries = dayEntries.filter((e) => e.content_type === col.type)
                    return (
                      <div
                        key={col.type}
                        className="border-r border-white/[0.04] p-2 last:border-r-0"
                      >
                        {colEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="group mb-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 last:mb-0"
                          >
                            <p className="text-sm font-medium text-slate-200">{entry.topic}</p>
                            {isAdmin && (
                              <div className="mt-1 flex items-center justify-between">
                                <p className="text-[11px] text-slate-500">{nameFor(entry.member_id)}</p>
                                <button
                                  onClick={() => remove(entry.id)}
                                  className="text-slate-600 opacity-0 transition hover:text-crimson group-hover:opacity-100"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PDF Upload Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Monthly Plan PDF" maxWidth="max-w-2xl">
        <PdfUploadForm
          members={members}
          defaultMonth={format(month, 'yyyy-MM')}
          onDone={() => { setUploadOpen(false); load() }}
        />
      </Modal>

      {/* Manual Add Modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Add Schedule Entry" maxWidth="max-w-lg">
        <ScheduleForm members={members} defaultMonth={format(month, 'yyyy-MM')} onDone={() => { setAssignOpen(false); load() }} />
      </Modal>
    </Layout>
  )
}

function PdfUploadForm({ members, defaultMonth, onDone }: { members: Profile[]; defaultMonth: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<ExtractedEntry[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (f: File) => {
    setFile(f)
    setParsing(true)
    setError(null)
    try {
      const text = await f.text()
      const entries = parsePdfText(text, defaultMonth, members)
      setExtracted(entries)
    } catch (e: any) {
      setError(`Failed to read file: ${e.message}`)
    }
    setParsing(false)
  }

  const updateEntry = (idx: number, field: keyof ExtractedEntry, value: string) => {
    setExtracted((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)))
  }

  const removeEntry = (idx: number) => {
    setExtracted((prev) => prev.filter((_, i) => i !== idx))
  }

  const save = async () => {
    if (extracted.length === 0) { setError('No entries to save.'); return }
    const invalid = extracted.some((e) => !e.date || !e.topic.trim() || !e.memberId)
    if (invalid) { setError('Each entry needs a date, topic, and assigned member.'); return }
    setSaving(true)
    setError(null)
    const rows = extracted.map((e) => ({
      member_id: e.memberId,
      topic: e.topic.trim(),
      content_type: e.contentType,
      due_date: new Date(e.date).toISOString(),
      month: defaultMonth,
    }))
    const { error: insErr } = await supabase.from('schedule').insert(rows)
    if (insErr) { setError(insErr.message); setSaving(false); return }
    for (const e of extracted) {
      await supabase.from('notifications').insert({
        user_id: e.memberId,
        type: 'task_assigned',
        message: `New schedule entry: "${e.topic.trim()}" (${e.contentType.toUpperCase()}) due ${format(new Date(e.date), 'd MMM yyyy')}.`,
      })
    }
    setSaving(false)
    onDone()
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="label">Upload Monthly Plan (PDF or Text file)</label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-sm text-slate-400 transition hover:border-gold/30 hover:text-slate-300">
          {file ? (
            <span className="flex items-center gap-2 text-slate-200">
              <FileText size={18} /> {file.name}
            </span>
          ) : (
            <><Upload size={18} /> Choose a file (PDF or .txt)</>
          )}
          <input
            type="file"
            accept=".pdf,.txt,text/plain,application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>

      {parsing && (
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Spinner size={18} /> Extracting entries from file…
        </div>
      )}

      {extracted.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-300">
              {extracted.length} entries found — review and assign members:
            </p>
            <button onClick={() => setExtracted([])} className="text-xs text-slate-500 hover:text-crimson">
              Clear all
            </button>
          </div>
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {extracted.map((entry, idx) => (
              <div key={idx} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Entry #{idx + 1}</span>
                  <button onClick={() => removeEntry(idx)} className="text-slate-600 hover:text-crimson">
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase text-slate-500">Date</label>
                    <input
                      type="date"
                      className="input py-1.5 text-sm"
                      value={entry.date}
                      onChange={(e) => updateEntry(idx, 'date', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500">Type</label>
                    <select
                      className="input py-1.5 text-sm"
                      value={entry.contentType}
                      onChange={(e) => updateEntry(idx, 'contentType', e.target.value)}
                    >
                      <option value="gd">GD</option>
                      <option value="video">Video</option>
                      <option value="post">Post</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-[10px] uppercase text-slate-500">Topic</label>
                  <input
                    className="input py-1.5 text-sm"
                    value={entry.topic}
                    onChange={(e) => updateEntry(idx, 'topic', e.target.value)}
                  />
                </div>
                <div className="mt-2">
                  <label className="text-[10px] uppercase text-slate-500">Assign to</label>
                  <select
                    className="input py-1.5 text-sm"
                    value={entry.memberId}
                    onChange={(e) => updateEntry(idx, 'memberId', e.target.value)}
                  >
                    <option value="">Select member…</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} disabled={saving} className="btn-gold w-full py-3">
            {saving ? <Spinner size={18} /> : <Save size={18} />} {saving ? 'Saving…' : `Save ${extracted.length} Entries`}
          </button>
        </div>
      )}

      {error && <p className="rounded-md border border-crimson/30 bg-crimson/10 px-4 py-2.5 text-sm text-crimson">{error}</p>}
    </div>
  )
}

function parsePdfText(text: string, monthStr: string, members: Profile[]): ExtractedEntry[] {
  const entries: ExtractedEntry[] = []
  const [year, mon] = monthStr.split('-').map(Number)
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const typeKeywords: Record<ContentType, string[]> = {
    gd: ['gd', 'group discussion', 'group-discussion'],
    video: ['video', 'reel', 'youtube'],
    post: ['post', 'instagram', 'caption', 'content post'],
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 3) continue

    let contentType: ContentType = 'post'
    const lower = trimmed.toLowerCase()
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        contentType = type as ContentType
        break
      }
    }

    const dateMatch = trimmed.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/) ||
      trimmed.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)
    let dateStr = ''
    if (dateMatch) {
      const d = parseInt(dateMatch[1])
      let m = mon
      let y = year
      if (dateMatch[2] && isNaN(parseInt(dateMatch[2]))) {
        const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
        m = monthNames.indexOf(dateMatch[2].toLowerCase()) + 1
        if (m === 0) m = mon
      } else if (dateMatch[2]) {
        m = parseInt(dateMatch[2])
      }
      if (dateMatch[3] && dateMatch[3].length === 4) y = parseInt(dateMatch[3])
      else if (dateMatch[3] && dateMatch[3].length === 2) y = 2000 + parseInt(dateMatch[3])
      dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    } else {
      const dayMatch = trimmed.match(/day\s*(\d{1,2})/i) || trimmed.match(/^(\d{1,2})\s*[-:]/)
      if (dayMatch) {
        const d = parseInt(dayMatch[1])
        dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }

    const topic = trimmed
      .replace(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/g, '')
      .replace(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, '')
      .replace(/day\s*\d{1,2}/i, '')
      .replace(/^\d{1,2}\s*[-:]/, '')
      .replace(/^(gd|video|post|group discussion|reel|youtube|instagram|caption|content post)\s*[-:]/i, '')
      .replace(/[,|:\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (topic.length < 2) continue

    entries.push({
      date: dateStr || `${year}-${String(mon).padStart(2, '0')}-15`,
      topic: topic.slice(0, 200),
      contentType,
      memberId: members[0]?.id ?? '',
    })
  }

  return entries
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
        {saving ? <Spinner size={18} /> : <CalendarDays size={18} />} {saving ? 'Saving…' : 'Add to Schedule'}
      </button>
    </form>
  )
}
