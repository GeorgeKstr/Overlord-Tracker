import { cn } from '@/lib/utils'
import type { Label } from '@platform/shared-types'

interface LabelBadgeProps {
  label: Label
  className?: string
  onRemove?: () => void
}

/** Renders a coloured pill badge for a ticket label. */
export function LabelBadge({ label, className, onRemove }: LabelBadgeProps) {
  // Ensure the stored colour is a valid hex; fall back to slate.
  const color = /^#[0-9a-f]{3,6}$/i.test(label.color) ? label.color : '#94a3b8'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-none',
        className,
      )}
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity"
          aria-label={`Remove ${label.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
