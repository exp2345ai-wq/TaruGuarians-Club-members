import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { Spinner } from '../components/ui'
import { Save, MessageCircle, Bot, Phone } from 'lucide-react'

type SettingsData = {
  admin_whatsapp_number: string | null
  whatsapp_provider: string | null
  ai_provider: string | null
  ai_api_key: string | null
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
      if (data) setSettings(data as SettingsData)
      setLoading(false)
    }
    load()
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const { error } = await supabase
      .from('app_settings')
      .update({
        admin_whatsapp_number: settings.admin_whatsapp_number || null,
        whatsapp_provider: settings.whatsapp_provider || null,
        ai_provider: settings.ai_provider || null,
        ai_api_key: settings.ai_api_key || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false)
    setSaved(true)
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
          <span className="text-gold glow-text">Settings</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">Connect the external services that power the AI safety-net and WhatsApp alerts.</p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-24"><Spinner size={32} /></div>
      ) : settings ? (
        <form onSubmit={save} className="mx-auto max-w-2xl space-y-8">
          <section className="card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald2/10"><MessageCircle size={20} className="text-emerald2" /></div>
              <div>
                <h2 className="font-display text-lg font-bold text-white">WhatsApp Auto-Send</h2>
                <p className="text-xs text-slate-500">AI-generated content is sent here when a member misses a deadline.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label"><span className="inline-flex items-center gap-1.5"><Phone size={11} /> Admin WhatsApp Number</span></label>
                <input className="input" value={settings.admin_whatsapp_number ?? ''} onChange={(e) => setSettings({ ...settings, admin_whatsapp_number: e.target.value })} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="label">WhatsApp Provider</label>
                <select className="input" value={settings.whatsapp_provider ?? ''} onChange={(e) => setSettings({ ...settings, whatsapp_provider: e.target.value })}>
                  <option value="">Not configured</option>
                  <option value="twilio">Twilio</option>
                  <option value="meta">Meta Cloud API</option>
                </select>
              </div>
            </div>
          </section>

          <section className="card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-gold/10"><Bot size={20} className="text-gold" /></div>
              <div>
                <h2 className="font-display text-lg font-bold text-white">AI Content Generation</h2>
                <p className="text-xs text-slate-500">Used to auto-generate GD scripts, video outlines, and posts for missed deadlines.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">AI Provider</label>
                <select className="input" value={settings.ai_provider ?? ''} onChange={(e) => setSettings({ ...settings, ai_provider: e.target.value })}>
                  <option value="">Not configured</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div>
                <label className="label">API Key</label>
                <input type="password" className="input" value={settings.ai_api_key ?? ''} onChange={(e) => setSettings({ ...settings, ai_api_key: e.target.value })} placeholder="sk-…" />
                <p className="mt-2 text-xs text-slate-600">Stored securely. Used only by the server-side fallback function.</p>
              </div>
            </div>
          </section>

          {error && <p className="rounded-md border border-crimson/30 bg-crimson/10 px-4 py-2.5 text-sm text-crimson">{error}</p>}
          {saved && <p className="rounded-md border border-emerald2/30 bg-emerald2/10 px-4 py-2.5 text-sm text-emerald2">Settings saved.</p>}

          <button type="submit" disabled={saving} className="btn-gold w-full py-3">
            {saving ? <Spinner size={18} /> : <Save size={18} />} {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Could not load settings.</p>
      )}
    </Layout>
  )
}
