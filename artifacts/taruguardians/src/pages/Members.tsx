import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, type Profile, type Content } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { ContentTypeBadge } from '../components/Badges'
import { Modal, Spinner, EmptyState } from '../components/ui'
import { format } from 'date-fns'
import { MapPin, Users, Search, Inbox } from 'lucide-react'

export default function Members() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Profile | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
      if (data) setMembers(data as Profile[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = members.filter((m) => {
    const q = query.toLowerCase()
    return (
      (m.full_name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.location?.toLowerCase().includes(q)) &&
      m.onboarded
    )
  })

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
          Member <span className="text-gold glow-text">Directory</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">The guardians of the guild. Tap a member to view their profile and public posts.</p>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-10"
          placeholder="Search by name or location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-24"><Spinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title="No members found" subtitle="Onboarded members will appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="card card-hover group flex flex-col items-center p-6 text-center animate-fade-in"
            >
              {m.photo_url ? (
                <img src={m.photo_url} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-gold/20 transition group-hover:ring-gold/50" />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-full bg-gold/10 text-2xl font-bold text-gold ring-2 ring-gold/20">
                  {(m.full_name || m.email).charAt(0).toUpperCase()}
                </div>
              )}
              <p className="mt-3 font-display text-base font-bold text-slate-100">{m.full_name || 'Unnamed'}</p>
              {m.location && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                  <MapPin size={11} /> {m.location}
                </p>
              )}
              {m.id === profile?.id && <span className="chip mt-2 border-gold/30 text-gold">You</span>}
              {m.role === 'admin' && <span className="chip mt-2 border-gold/30 text-gold">Admin</span>}
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Member Profile" maxWidth="max-w-2xl">
        {selected && <MemberProfile member={selected} />}
      </Modal>
    </Layout>
  )
}

function MemberProfile({ member }: { member: Profile }) {
  const [posts, setPosts] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', member.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setPosts(data as Content[])
      setLoading(false)
    }
    load()
  }, [member.id])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5">
        {member.photo_url ? (
          <img src={member.photo_url} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-gold/30" />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-full bg-gold/10 text-2xl font-bold text-gold">
            {(member.full_name || member.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h3 className="font-display text-xl font-bold text-white">{member.full_name || 'Unnamed'}</h3>
          {member.location && <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-400"><MapPin size={13} /> {member.location}</p>}
          {member.role === 'admin' && <span className="chip mt-2 border-gold/30 text-gold">Admin</span>}
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Public Posts</h4>
        {loading ? (
          <div className="grid place-items-center py-8"><Spinner size={24} /></div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Inbox size={28} className="text-slate-600" />
            <p className="text-sm text-slate-500">No public posts yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-200">{p.topic}</p>
                  <p className="text-xs text-slate-500">{format(new Date(p.created_at), 'd MMM yyyy')}</p>
                </div>
                <ContentTypeBadge type={p.type} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
