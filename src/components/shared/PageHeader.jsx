export default function PageHeader({ title, subtitle, action, compact = false }) {
  return (
    <div className={`flex items-start justify-between ${compact ? 'mb-4' : 'mb-6'}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          {compact && subtitle && (
            <span
              title={subtitle}
              className="inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Info
            </span>
          )}
        </div>
        {subtitle && !compact && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
