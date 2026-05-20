import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date)
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

// Text + icon color
export const TICKET_STATUS_COLORS: Record<string, string> = {
  OPEN: 'text-sky-500 dark:text-sky-300',
  IN_PROGRESS: 'text-amber-500 dark:text-amber-300',
  IN_REVIEW: 'text-violet-500 dark:text-violet-300',
  DONE: 'text-emerald-500 dark:text-emerald-300',
  CANCELLED: 'text-red-500 dark:text-red-400',
}

export const TICKET_STATUS_BG: Record<string, string> = {
  OPEN: 'border-sky-300/70 bg-sky-500/10 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-300',
  IN_PROGRESS: 'border-amber-300/70 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300',
  IN_REVIEW: 'border-violet-300/70 bg-violet-500/10 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-300',
  DONE: 'border-emerald-300/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300',
  CANCELLED: 'border-red-300/70 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-300',
}

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const TICKET_PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-slate-400 dark:text-slate-400',
  MEDIUM: 'text-amber-500 dark:text-amber-400',
  HIGH: 'text-orange-500 dark:text-orange-400',
  CRITICAL: 'text-red-500 dark:text-red-400',
}

export const TICKET_PRIORITY_BG: Record<string, string> = {
  LOW: 'border-slate-300/70 bg-slate-500/10 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/20 dark:text-slate-300',
  MEDIUM: 'border-amber-300/70 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300',
  HIGH: 'border-orange-300/70 bg-orange-500/10 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/20 dark:text-orange-300',
  CRITICAL: 'border-red-300/70 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-300',
}

export const TICKET_EFFORT_LABELS: Record<string, string> = {
  MINOR: 'Minor',
  NORMAL: 'Normal',
  EPIC: 'Epic',
}

export const SERVICE_STATUS_COLORS: Record<string, string> = {
  HEALTHY: 'bg-green-500',
  DEGRADED: 'bg-yellow-500',
  DOWN: 'bg-red-500',
  UNKNOWN: 'bg-slate-400',
}
