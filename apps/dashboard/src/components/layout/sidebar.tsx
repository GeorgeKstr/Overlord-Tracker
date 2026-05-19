'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FolderKanban,
  Server,
  Activity,
  Shield,
  ChevronRight,
} from 'lucide-react'
import { OvLogo } from '@/components/logo'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import type { UserSummary } from '@platform/shared-types'

const navItems = [
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/services', label: 'Services', icon: Server },
  { href: '/health', label: 'Health', icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<UserSummary>('/users/me'),
  })

  const items = me?.role === 'ADMIN'
    ? [...navItems, { href: '/admin', label: 'Admin', icon: Shield }]
    : navItems

  return (
    <aside className="w-60 flex-shrink-0 border-r bg-card flex flex-col">
      <div className="h-16 flex items-center px-5 border-b">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <OvLogo className="w-5 h-5" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Overlord Tracker</span>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5">
        <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Platform
        </p>
        {items.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {isActive && (
                <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t">
        <p className="px-3 text-[10px] text-muted-foreground">
          Overlord Tracker v0.1
        </p>
      </div>
    </aside>
  )
}
