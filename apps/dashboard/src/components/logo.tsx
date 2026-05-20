import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * Overlord Tracker logo — oversized villain crown with dramatic horns and glowing eye.
 * Uses currentColor so it inherits whatever text/fill color is set on the parent.
 */
export function OvLogo({ className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="currentColor"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Left exaggerated horn */}
      <path d="M14 33 C6 30 2 21 5 13 C8 15 11 19 14 24 C12 26 12 30 14 33 Z" />
      {/* Right exaggerated horn */}
      <path d="M34 33 C42 30 46 21 43 13 C40 15 37 19 34 24 C36 26 36 30 34 33 Z" />
      {/* Main crown with jagged spikes */}
      <path d="M15 43 C13 43 12 42 12 40 V26 L18 16 L22 24 L24 7 L26 24 L30 16 L36 26 V40 C36 42 35 43 33 43 Z" />
      {/* Lower brim for a heavier silhouette */}
      <path d="M11 35 H37 V39 C37 41.5 35.5 43 33 43 H15 C12.5 43 11 41.5 11 39 Z" opacity="0.28" />
      {/* Menacing eye highlight */}
      <path d="M19 31 C21 27 27 27 29 31 C27 33 21 33 19 31 Z" fill="white" opacity="0.38" />
      <circle cx="24" cy="31" r="1.8" fill="white" opacity="0.5" />
    </svg>
  )
}
