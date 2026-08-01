import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, type Notification } from '../lib/supabase'
import { Logo } from './Logo'
import {
  LayoutDashboard,
  Users,
  ListChecks,
  MessagesSquare,
  CalendarDays,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/chat', label: 'Chat', icon: MessagesSquare },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!profile) return
    const loadNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifs(data as Notification[])
    }
    loadNotifs()

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          setNotifs((prev) => [payload.new as Notification, ...prev])
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  const unreadCount = notifs.filter((n) => !n.read).length

  const markAllRead = async () => {
    if (!profile) return
    const unread = notifs.filter((n) => !n.read).map((n) => n.id)
    if (unread.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', unread)
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const items = isAdmin ? [...navItems, { to: '/admin', label: 'Admin', icon: ShieldCheck }, { to: '/settings', label: 'Settings', icon: Settings }] : navItems

  return (
    <div className="flex min-h-screen bg-obsidian">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-slatecard/50 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
          <Link to="/dashboard"><Logo size="sm" /></Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {items.map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-gold/10 text-gold shadow-glow-sm'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <Icon size={18} className={active ? 'text-gold' : 'text-slate-500 group-hover:text-slate-300'} />
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold" />}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-3">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-gold/30" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-sm font-bold text-gold">
                {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-200">{profile?.full_name || 'Member'}</p>
              <p className="truncate text-xs text-slate-500">{isAdmin ? 'Admin' : 'Member'}</p>
            </div>
            <button onClick={handleSignOut} className="text-slate-500 transition hover:text-crimson" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.06] bg-slatecard/80 px-4 backdrop-blur-xl lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="text-slate-300"><Menu size={22} /></button>
        <Logo size="sm" />
        <NotifBell unreadCount={unreadCount} onClick={() => setNotifOpen(true)} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-white/10 bg-slatecard p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <Logo size="sm" />
              <button onClick={() => setMobileOpen(false)} className="text-slate-400"><X size={20} /></button>
            </div>
            <nav className="space-y-1">
              {items.map((item) => {
                const active = location.pathname === item.to
                const Icon = item.icon
                return (
                  <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? 'bg-gold/10 text-gold' : 'text-slate-400 hover:bg-white/[0.04]'}`}>
                    <Icon size={18} /> {item.label}
                  </Link>
                )
              })}
            </nav>
            <button onClick={handleSignOut} className="mt-6 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-crimson hover:bg-crimson/10">
              <LogOut size={18} /> Sign out
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-white/[0.06] bg-obsidian/80 px-8 backdrop-blur-xl lg:flex">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {items.find((i) => location.pathname.startsWith(i.to))?.label ?? 'TaruGuardians'}
          </p>
          <NotifBell unreadCount={unreadCount} onClick={() => setNotifOpen(true)} />
        </header>

        <main className="flex-1 px-4 pb-24 pt-20 lg:px-8 lg:pb-8 lg:pt-8">
          {children}
        </main>
      </div>

      {notifOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setNotifOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-white/10 bg-slatecard p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs font-medium text-gold hover:text-gold-soft">Mark all read</button>
                )}
                <button onClick={() => setNotifOpen(false)} className="text-slate-400"><X size={18} /></button>
              </div>
            </div>
            <div className="space-y-2 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No notifications yet.</p>
              ) : (
                notifs.map((n) => (
                  <div key={n.id} className={`rounded-lg border p-3 ${n.read ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gold/20 bg-gold/[0.06]'}`}>
                    <p className="text-sm text-slate-200">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NotifBell({ unreadCount, onClick }: { unreadCount: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative text-slate-300 transition hover:text-gold">
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-crimson px-1 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </button>
  )
}
