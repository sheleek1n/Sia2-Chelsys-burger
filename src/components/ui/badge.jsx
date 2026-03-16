import { cn } from '@/lib/utils'

export function Badge({ className, variant = 'default', ...props }) {
  const variants = {
    default: 'bg-primary/10 text-primary',
    secondary: 'bg-muted text-muted-foreground',
    destructive: 'bg-destructive/10 text-destructive',
    outline: 'border border-input',
  }
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', variants[variant], className)}
      {...props}
    />
  )
}
