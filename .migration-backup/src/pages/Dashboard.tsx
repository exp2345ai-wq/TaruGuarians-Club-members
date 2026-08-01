import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, type Content, type ContentType } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { ContentTypeBadge, AITag } from '../components/Badges'
import { EmptyState, Modal, Spinner } from '../components/ui'
import { format } from 'date-fns'
import { Upload, FileText, Inbox } from 'lucide-react'

export default function Dashboard() {
  const { profile } = useAuth()
  const [items, setItems] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Content | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const { data } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
      if (data) setItems(data as Content[])
      setLoading(false)
    }
    load()
  }, [profile])

  return (
    <Layout>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
            Your <span className="text-gold glow-text">Content</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Everything you've uploaded — GDs, videos, and posts.</p>
        </div>
        <button onClick={() => setUploadOpen(true)} className="btn-gold">
          <Upload size={18} /> Upload Content
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-24"><Spinner size={32} /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Inbox size={40} />}
          title="No content yet"
          subtitle="Upload your first GD, video, or post to see it here."
          action={<button onClick={() => setUploadOpen(true)} className="btn-gold"><Upload size={18} /> Upload Content</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="card card-hover p-5 text-left animate-fade-in"
            >
              <div className="mb-3 flex items-center justify-between">
                <ContentTypeBadge type={item.type} />
                {item.ai_generated && <AITag />}
              </div>
              <h3 className="line-clamp-2 font-display text-base font-bold text-slate-100">{item.topic}</h3>
              <p className="mt-3 text-xs text-slate-500">
                Uploaded {format(new Date(item.created_at), 'd MMM yyyy')}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Content Detail" maxWidth="max-w-2xl">
        {selected && <ContentDetail item={selected} />}
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Content" maxWidth="max-w-xl">
        <UploadForm onDone={() => { setUploadOpen(false); window.location.reload() }} />
      </Modal>
    </Layout>
  )
}

function ContentDetail({ item }: { item: Content }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ContentTypeBadge type={item.type} />
        {item.ai_generated && <AITag />}
      </div>
      <h3 className="font-display text-xl font-bold text-white">{item.topic}</h3>
      <p className="text-sm text-slate-400">
        Uploaded {format(new Date(item.created_at), 'd MMM yyyy, HH:mm')}
      </p>
      {item.description && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-sm leading-relaxed text-slate-300">{item.description}</p>
        </div>
      )}
      {item.file_url && item.type === 'video' && (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <video src={item.file_url} controls className="w-full" />
        </div>
      )}
      {item.file_url && item.type !== 'video' && (
        <a href={item.file_url} target="_blank" rel="noreferrer" className="btn-ghost w-full">
          <FileText size={16} /> View attached file
        </a>
      )}
      {!item.file_url && !item.description && (
        <p className="text-sm text-slate-500">No additional media attached.</p>
      )}
    </div>
  )
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth()
  const [type, setType] = useState<ContentType>('gd')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (!topic.trim()) { setError('Topic is required.'); return }
    setSaving(true)
    setError(null)
    let fileUrl: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `content/${profile.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('content').upload(path, file)
      if (upErr) { setError(upErr.message); setSaving(false); return }
      const { data: pub } = supabase.storage.from('content').getPublicUrl(path)
      fileUrl = pub.publicUrl
    }
    const { error: insErr } = await supabase.from('content').insert({
      user_id: profile.id,
      type,
      topic: topic.trim(),
      description: description.trim() || null,
      file_url: fileUrl,
      ai_generated: false,
    })
    if (insErr) { setError(insErr.message); setSaving(false); return }
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label">Content Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['gd', 'video', 'post'] as ContentType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-md border px-3 py-2.5 text-sm font-semibold uppercase transition ${
                type === t ? 'border-gold/50 bg-gold/10 text-gold' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Topic</label>
        <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Leadership in Tech" />
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <textarea className="input min-h-[100px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notes or script…" />
      </div>
      <div>
        <label className="label">Attach file (optional)</label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-sm text-slate-400 transition hover:border-gold/30 hover:text-slate-300">
          {file ? <span className="text-slate-200">{file.name}</span> : <><Upload size={16} /> Choose a file</>}
          <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
        </label>
      </div>
      {error && <p className="rounded-md border border-crimson/30 bg-crimson/10 px-4 py-2.5 text-sm text-crimson">{error}</p>}
      <button type="submit" disabled={saving} className="btn-gold w-full py-3">
        {saving ? <Spinner size={18} /> : <Upload size={18} />} {saving ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  )
}
