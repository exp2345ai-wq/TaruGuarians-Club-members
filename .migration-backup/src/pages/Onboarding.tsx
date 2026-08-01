import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/ui'
import { Camera, MapPin, Upload } from 'lucide-react'

export default function Onboarding() {
  const { profile, refreshProfile, session } = useAuth()
  const navigate = useNavigate()
  const [location, setLocation] = useState('')
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (!profile) return
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${profile.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      setPhotoUrl(pub.publicUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (!location.trim()) {
      setError('Please tell us where you are from.')
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        photo_url: photoUrl || null,
        location: location.trim(),
        onboarded: true,
      })
      .eq('id', profile.id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    await refreshProfile()
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-obsidian px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-lg animate-scale-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="md" />
          <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-white">
            Welcome to the Guild
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Let's set up your member profile before you enter the platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-6 p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-24 w-24 rounded-full object-cover ring-2 ring-gold/40" />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-full bg-white/[0.04] ring-2 ring-white/10">
                  <Camera size={28} className="text-slate-500" />
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-gold text-obsidian shadow-glow-sm transition hover:bg-gold-soft">
                {uploading ? <Spinner size={14} /> : <Upload size={14} />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
            </div>
            <p className="text-xs text-slate-500">Upload your profile photo</p>
          </div>

          <div>
            <label className="label">Full Name</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="label">
              <span className="inline-flex items-center gap-1.5"><MapPin size={12} /> Where are you from?</span>
            </label>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
            />
          </div>

          {error && (
            <p className="rounded-md border border-crimson/30 bg-crimson/10 px-4 py-2.5 text-sm text-crimson">{error}</p>
          )}

          <button type="submit" disabled={saving || uploading} className="btn-gold w-full py-3">
            {saving ? <Spinner size={18} /> : null}
            {saving ? 'Saving…' : 'Enter TaruGuardians'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
          Signed in as {session?.user?.email}
        </p>
      </div>
    </div>
  )
}
