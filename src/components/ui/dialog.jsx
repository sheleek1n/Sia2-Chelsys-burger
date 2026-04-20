import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    // Always clear on unmount — guards against any mid-render close
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Second safety net: if component unmounts while open, clear immediately
  useEffect(() => {
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault()
        onOpenChange?.(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onOpenChange?.(false) }}>
      <div className="fixed inset-0 bg-black/50" aria-hidden />
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
