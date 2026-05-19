import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * Overlord Tracker logo — cartoony crown with evil side horns.
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
      {/* Left evil horn */}
      <path d="M14,32 C6,28 2,18 6,12 C8,16 11,22 14,26 Z" />
      {/* Right evil horn */}
      <path d="M34,32 C42,28 46,18 42,12 C40,16 37,22 34,26 Z" />
      {/* Crown body — three teeth, rounded base corners */}
      <path d="M16,44 Q14,44 14,42 L14,26 L18,16 L22,24 L24,8 L26,24 L30,16 L34,26 L34,42 Q34,44 32,44 Z" />
      {/* Crown gem */}
      <circle cx="24" cy="35" r="3.5" fill="white" opacity="0.35" />
      <circle cx="23" cy="34" r="1.5" fill="white" opacity="0.25" />
    </svg>
  )
}
