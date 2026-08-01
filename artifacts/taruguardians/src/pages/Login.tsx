import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/ui'
import { Chrome, ShieldCheck, Zap, Users } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/onboarding-check`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  if (session) {
    navigate('/onboarding-check', { replace: true })
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-obsidian px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald2/5 blur-[100px]" />

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-slate-400">
            The private command center for an elite club. Sign in to access your content, tasks, and team.
          </p>
        </div>

        <div className="card p-8">
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="btn-gold w-full py-3.5 text-base"
          >
            {loading ? <Spinner size={20} /> : <Chrome size={20} />}
            {loading ? 'Connecting…' : 'Continue with Google'}
          </button>

          {error && (
            <p className="mt-4 rounded-md border border-crimson/30 bg-crimson/10 px-4 py-2.5 text-sm text-crimson">
              {error}
            </p>
          )}

          <p className="mt-5 text-center text-xs text-slate-500">
            New members are prompted to set up their profile after first sign-in.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: ShieldCheck, label: 'Secure' },
            { icon: Zap, label: 'Automated' },
            { icon: Users, label: 'Connected' },
          ].map((f) => {
            const Icon = f.icon
            return (
              <div key={f.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-3">
                <Icon size={18} className="mx-auto text-gold/70" />
                <p className="mt-1.5 text-xs font-medium text-slate-400">{f.label}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
