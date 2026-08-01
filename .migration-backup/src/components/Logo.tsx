import { Shield } from 'lucide-react'

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-16 w-16' }
  const icon = { sm: 18, md: 22, lg: 34 }
  const text = { sm: 'text-lg', md: 'text-xl', lg: 'text-3xl' }
  return (
    <div className="flex items-center gap-3">
      <div className={`${dims[size]} grid place-items-center rounded-lg border border-gold/30 bg-gradient-to-br from-gold/20 to-gold/5 shadow-glow-sm`}>
        <Shield size={icon[size]} className="text-gold" strokeWidth={2.5} />
      </div>
      <div className="leading-none">
        <span className={`font-display ${text[size]} font-extrabold tracking-tight text-white`}>
          Taru<span className="text-gold glow-text">Guardians</span>
        </span>
        {size === 'lg' && (
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
            Elite Club Platform
          </p>
        )}
      </div>
    </div>
  )
}
