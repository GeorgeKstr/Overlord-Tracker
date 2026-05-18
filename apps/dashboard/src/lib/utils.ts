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
  OPEN: 'text-sky-600 dark:text-sky-300',
  IN_PROGRESS: 'text-amber-600 dark:text-amber-300',
  IN_REVIEW: 'text-violet-600',
  DONE: 'text-green-600',
  CANCELLED: 'text-red-500',
}

// Pill background + text (for badges)
export const TICKET_STATUS_BG: Record<string, string> = {
  OPEN: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  IN_REVIEW: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  DONE: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  CANCELLED: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300',
}

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const TICKET_PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-slate-500',
  MEDIUM: 'text-amber-500 dark:text-amber-300',
  HIGH: 'text-orange-500',
  CRITICAL: 'text-red-600',
}

export const TICKET_PRIORITY_BG: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  MEDIUM: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  HIGH: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

export const SERVICE_STATUS_COLORS: Record<string, string> = {
  HEALTHY: 'bg-green-500',
  DEGRADED: 'bg-yellow-500',
  DOWN: 'bg-red-500',
  UNKNOWN: 'bg-slate-400',
}
