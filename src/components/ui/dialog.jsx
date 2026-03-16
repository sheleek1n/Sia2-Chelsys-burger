import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} aria-hidden />
      {children}
    </div>
  )
}

export function DialogContent({ children, className }) {
  return (
    <div
      className={cn('relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg', className)}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

export function DialogHeader({ children }) {
  return <div className="flex flex-col space-y-1.5 text-center sm:text-left">{children}</div>
}

export function DialogTitle({ children, className }) {
  return <h2 className={cn('text-lg font-semibold leading-none', className)}>{children}</h2>
}
