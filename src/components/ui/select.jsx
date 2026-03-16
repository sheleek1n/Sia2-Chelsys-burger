import { Children, createContext, isValidElement, useContext, useState, useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'

const SelectContext = createContext(null)

export function Select({ value, onValueChange, children, className, disabled = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selectedLabel = useMemo(() => {
    const hasValue = value !== undefined && value !== null && String(value) !== ''
    if (!hasValue) return null

    function findLabel(nodes) {
      let found = null
      Children.forEach(nodes, (node) => {
        if (found !== null || !isValidElement(node)) return

        const nodeValue = node.props?.value
        if (nodeValue !== undefined && String(nodeValue) === String(value)) {
          found = node.props?.children
          return
        }

        if (node.props?.children) {
          const nested = findLabel(node.props.children)
          if (nested !== null) found = nested
        }
      })
      return found
    }

    return findLabel(children)
  }, [children, value])

  useEffect(() => {
    if (disabled && open) setOpen(false)
  }, [disabled, open])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, disabled, selectedLabel }}>
      <div ref={ref} className={cn('relative', className)}>
        {children}
      </div>
    </SelectContext.Provider>
  )
}

export function SelectTrigger({ children, className, placeholder = 'Select...' }) {
  const ctx = useContext(SelectContext)
  if (!ctx) return null
  const { open, setOpen, value, disabled, selectedLabel } = ctx
  const hasValue = value !== undefined && value !== null && String(value) !== ''
  const label = typeof children === 'object' && children?.props?.children
  return (
    <button
      type="button"
      onClick={() => !disabled && setOpen(!open)}
      disabled={disabled}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      <span className={cn(!hasValue && 'text-muted-foreground')}>
        {hasValue ? (selectedLabel ?? value) : (label ?? placeholder)}
      </span>
      <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

export function SelectContent({ children, className }) {
  const ctx = useContext(SelectContext)
  if (!ctx || !ctx.open) return null
  const { value, onValueChange, setOpen, disabled } = ctx
  if (disabled) return null
  const items = Array.isArray(children) ? children : [children]
  return (
    <div className={cn('absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-card p-1 shadow-lg', className)}>
      {items.filter(Boolean).map((child) => {
        const itemValue = child?.props?.value
        if (itemValue === undefined) return child
        const isSelected = String(value) === String(itemValue)
        const itemDisabled = Boolean(child?.props?.disabled)
        return (
          <div
            key={itemValue}
            role="option"
            className={cn(
              'rounded-sm py-2 px-2 text-sm',
              itemDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent hover:text-accent-foreground',
              isSelected && 'bg-accent'
            )}
            onClick={() => {
              if (itemDisabled) return
              onValueChange(itemValue)
              setOpen(false)
            }}
          >
            {child.props.children}
          </div>
        )
      })}
    </div>
  )
}

export function SelectItem({ children, value, className }) {
  return null
}

export function SelectValue({ placeholder }) {
  return placeholder
}
