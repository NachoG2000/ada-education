import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export function StartupSurface({
  title,
  detail,
  actionLabel,
  onAction,
  children,
}: {
  title: string
  detail?: string
  actionLabel?: string
  onAction?: () => void
  children?: ReactNode
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6">
        <h1 className="text-base font-semibold">{title}</h1>
        {detail ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p> : null}
        {children}
        {actionLabel && onAction ? <Button className="mt-5" onClick={onAction}>{actionLabel}</Button> : null}
      </section>
    </main>
  )
}
