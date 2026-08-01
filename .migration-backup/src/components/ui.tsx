import type { ReactNode } from 'react'

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-white/10 border-t-gold"
      style={{ width: size, height: size }}
    />
  )
}

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-obsidian">
      <div className="flex flex-col items-center gap-4">
        <Spinner size={36} />
        <p className="text-sm font-medium text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-8 py-16 text-center animate-fade-in">
      {icon && <div className="mb-1 text-slate-600">{icon}</div>}
      <p className="font-display text-lg font-bold text-slate-200">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-slate-500">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  children,
  title,
  maxWidth = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  maxWidth?: string
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`card w-full ${maxWidth} animate-scale-in p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="section-title mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
