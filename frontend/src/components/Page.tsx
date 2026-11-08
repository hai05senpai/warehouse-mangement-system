import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export function Page({ eyebrow, title, description, action, children }: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return <section className="page">
    <div className="page-heading"><div><div className="eyebrow">{eyebrow ?? 'VẬN HÀNH KHO'}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
    {children}
  </section>
}

export function Notice({ message, kind = 'error' }: { message: string; kind?: 'error' | 'success' }) {
  const Icon = kind === 'success' ? CheckCircle2 : AlertCircle
  return <div className={`notice notice-${kind}`} role="status"><Icon size={17} />{message}</div>
}

export function Panel({ title, subtitle, action, children }: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}
