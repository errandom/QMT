import { ReactNode, useLayoutEffect, useRef } from 'react'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface OperationsCardGridProps {
  children: ReactNode
  columns?: 1 | 2 | 3
}

export function OperationsCardGrid({ children, columns = 3 }: OperationsCardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const sections = Array.from(grid.querySelectorAll<HTMLElement>('[data-operations-section]'))
    const alignSections = () => {
      const heights = new Map<string, number>()
      // Measure natural content, not the equalized wrappers, so sections can shrink too.
      for (const section of sections) {
        const name = section.dataset.operationsSection!
        heights.set(name, Math.max(heights.get(name) || 0, section.getBoundingClientRect().height))
      }
      for (const [name, height] of heights) {
        grid.style.setProperty(`--operations-${name}-height`, `${Math.ceil(height)}px`)
      }
    }

    const observer = new ResizeObserver(alignSections)
    sections.forEach(section => observer.observe(section))
    alignSections()
    return () => observer.disconnect()
  }, [children])

  return (
    <div ref={gridRef} className={cn(
      'grid auto-rows-fr gap-4',
      columns >= 2 && 'md:grid-cols-2',
      columns === 3 && 'lg:grid-cols-3'
    )}>
      {children}
    </div>
  )
}

interface OperationsCardSectionProps {
  name: string
  children?: ReactNode
  className?: string
}

export function OperationsCardSection({ name, children, className }: OperationsCardSectionProps) {
  return (
    <div className="min-w-0" style={{ minHeight: `var(--operations-${name}-height)` }}>
      <div data-operations-section={name} className={cn('min-w-0 [overflow-wrap:anywhere]', className)}>
        {children}
      </div>
    </div>
  )
}

interface OperationsCardHeaderProps {
  title: ReactNode
  icon?: ReactNode
  subtitle?: ReactNode
  badges: ReactNode
  actions?: ReactNode
  titleClassName?: string
}

export function OperationsCardHeader({ title, icon, subtitle, badges, actions, titleClassName }: OperationsCardHeaderProps) {
  return (
    <CardHeader>
      <OperationsCardSection name="title" className="flex items-start justify-between gap-2">
        <CardTitle className={cn('flex min-w-0 flex-1 items-start gap-2 text-base leading-snug', titleClassName)} style={{ color: COLORS.NAVY }}>
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
        </CardTitle>
        {actions && <div className="flex max-w-1/2 shrink-0 flex-wrap justify-end gap-1">{actions}</div>}
      </OperationsCardSection>
      {subtitle !== undefined && (
        <OperationsCardSection name="subtitle" className="text-xs text-muted-foreground">
          {subtitle}
        </OperationsCardSection>
      )}
      <OperationsCardSection name="badges" className="flex flex-wrap gap-2">
        {badges}
      </OperationsCardSection>
    </CardHeader>
  )
}
