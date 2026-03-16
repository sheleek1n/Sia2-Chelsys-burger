import { cn } from '@/lib/utils'

export function Button({ className, variant = 'default', size = 'default', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-transparent hover:bg-muted',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  }
  const sizes = { default: 'h-10 px-4 py-2', sm: 'h-8 rounded-md px-3 text-sm', lg: 'h-11 rounded-md px-8' }
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
}
