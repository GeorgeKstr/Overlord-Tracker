import {
  Circle,
  CircleDot,
  Eye,
  CheckCircle2,
  XCircle,
  ArrowDown,
  Minus,
  ArrowUp,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_BG,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_BG,
  TICKET_PRIORITY_COLORS,
} from '@/lib/utils'

// ─── Status ─────────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, React.ElementType> = {
  OPEN: Circle,
  IN_PROGRESS: CircleDot,
  IN_REVIEW: Eye,
  DONE: CheckCircle2,
  CANCELLED: XCircle,
}

interface StatusBadgeProps {
  status: string
  className?: string
  iconOnly?: boolean
}

export function StatusBadge({ status, className, iconOnly }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status] ?? Circle
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        TICKET_STATUS_BG[status],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {!iconOnly && (TICKET_STATUS_LABELS[status] ?? status)}
    </span>
  )
}

export function StatusIcon({ status, className }: { status: string; className?: string }) {
  const Icon = STATUS_ICONS[status] ?? Circle
  return <Icon className={cn('h-4 w-4', TICKET_STATUS_COLORS[status], className)} />
}

// ─── Priority ────────────────────────────────────────────────────────────────

const PRIORITY_ICONS: Record<string, React.ElementType> = {
  LOW: ArrowDown,
  MEDIUM: Minus,
  HIGH: ArrowUp,
  CRITICAL: AlertTriangle,
}

interface PriorityBadgeProps {
  priority: string
  className?: string
  iconOnly?: boolean
}

export function PriorityBadge({ priority, className, iconOnly }: PriorityBadgeProps) {
  const Icon = PRIORITY_ICONS[priority] ?? Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        TICKET_PRIORITY_BG[priority],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {!iconOnly && (TICKET_PRIORITY_LABELS[priority] ?? priority)}
    </span>
  )
}

export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const Icon = PRIORITY_ICONS[priority] ?? Minus
  return <Icon className={cn('h-4 w-4', TICKET_PRIORITY_COLORS[priority], className)} />
}
