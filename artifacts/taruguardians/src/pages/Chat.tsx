import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, type Profile, type Message } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { Spinner, EmptyState } from '../components/ui'
import { format } from 'date-fns'
import { MessagesSquare, Send, Search, ArrowLeft } from 'lucide-react'

export default function Chat() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<Profile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mobileChat, setMobileChat] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('onboarded', true)
      if (data) setMembers((data as Profile[]).filter((m) => m.id !== profile?.id))
      setLoading(false)
    }
    load()
  }, [profile])

  useEffect(() => {
    if (!activeId || !profile) return
    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${activeId}),and(sender_id.eq.${activeId},receiver_id.eq.${profile.id})`)
        .order('sent_at', { ascending: true })
      if (data) setMessages(data as Message[])
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', profile.id)
        .eq('sender_id', activeId)
        .eq('read', false)
    }
    load()

    const channel = supabase
      .channel(`chat-${activeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const m = payload.new as Message
          if (
            (m.sender_id === activeId && m.receiver_id === profile.id) ||
            (m.sender_id === profile.id && m.receiver_id === activeId)
          ) {
            setMessages((prev) => [...prev, m])
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeId, profile])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !activeId || !text.trim()) return
    const { data } = await supabase
      .from('messages')
      .insert({ sender_id: profile.id, receiver_id: activeId, text: text.trim() })
      .select('*')
      .maybeSingle()
    if (data) {
      setMessages((prev) => [...prev, data as Message])
      setText('')
      const senderName = profile.full_name || profile.email
      await supabase.from('notifications').insert({
        user_id: activeId,
        type: 'message',
        message: `${senderName} sent you a message`,
      })
    }
  }

  const activeMember = members.find((m) => m.id === activeId)
  const filtered = members.filter((m) =>
    (m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
          <span className="text-gold glow-text">Chat</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">Direct, real-time messaging with any guardian.</p>
      </div>

      <div className="card flex h-[calc(100vh-16rem)] overflow-hidden">
        <div className={`flex w-full flex-col border-r border-white/[0.06] lg:w-72 ${mobileChat ? 'hidden' : 'flex'}`}>
          <div className="border-b border-white/[0.06] p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input py-2 pl-9 text-sm" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="grid place-items-center py-12"><Spinner size={24} /></div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No members.</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setActiveId(m.id); setMobileChat(true) }}
                  className={`flex w-full items-center gap-3 border-b border-white/[0.03] px-4 py-3 text-left transition ${activeId === m.id ? 'bg-gold/[0.08]' : 'hover:bg-white/[0.03]'}`}
                >
                  {m.photo_url ? (
                    <img src={m.photo_url} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-gold/10 text-sm font-bold text-gold">{(m.full_name || m.email).charAt(0).toUpperCase()}</div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-200">{m.full_name || 'Unnamed'}</p>
                    {m.location && <p className="truncate text-xs text-slate-500">{m.location}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={`flex flex-1 flex-col ${mobileChat ? 'flex' : 'hidden lg:flex'}`}>
          {!activeId ? (
            <div className="grid flex-1 place-items-center">
              <EmptyState icon={<MessagesSquare size={40} />} title="Select a member to chat" subtitle="Pick someone from the list to start a conversation." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                <button onClick={() => setMobileChat(false)} className="text-slate-400 lg:hidden"><ArrowLeft size={18} /></button>
                {activeMember?.photo_url ? (
                  <img src={activeMember.photo_url} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-gold/20" />
                ) : (
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gold/10 text-sm font-bold text-gold">{(activeMember?.full_name || activeMember?.email || '?').charAt(0).toUpperCase()}</div>
                )}
                <p className="font-display text-sm font-bold text-slate-100">{activeMember?.full_name || 'Unnamed'}</p>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((m) => {
                  const mine = m.sender_id === profile?.id
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-gold/15 text-gold-soft' : 'bg-white/[0.05] text-slate-200'}`}>
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className="mt-1 text-right text-[10px] text-slate-500">{format(new Date(m.sent_at), 'd MMM, HH:mm')}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={send} className="flex items-center gap-2 border-t border-white/[0.06] p-3">
                <input
                  className="input flex-1"
                  placeholder="Type a message…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button type="submit" disabled={!text.trim()} className="btn-gold px-4 py-2.5">
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
