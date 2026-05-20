'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  FolderKanban,
  Server,
  Activity,
  Shield,
  ChevronRight,
  ChevronLeft,
  ListTodo,
  Copy,
  Check,
} from 'lucide-react'
import { OvLogo } from '@/components/logo'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { buildSchemaApiUrl, getStoredOverlordBaseUrl } from '@/lib/overlord-links'
import { useQuery } from '@tanstack/react-query'
import type { UserSummary } from '@platform/shared-types'

const navItems = [
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/my-tickets', label: 'My Tickets', icon: ListTodo },
  { href: '/services', label: 'Services', icon: Server },
  { href: '/health', label: 'Health', icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [overlordBaseUrl, setOverlordBaseUrl] = useState('')
  const [copiedSchema, setCopiedSchema] = useState(false)
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<UserSummary>('/users/me'),
  })

  const { data: myTicketsData } = useQuery({
    queryKey: ['my-tickets-count', me?.id],
    queryFn: () => api.get<{ total: number }>(`/tickets?assigneeId=${me!.id}&pageSize=1`),
    enabled: !!me?.id,
    staleTime: 60_000,
  })
  const myTicketTotal = myTicketsData?.total ?? 0

  useEffect(() => {
    setOverlordBaseUrl(getStoredOverlordBaseUrl())
    const refresh = () => setOverlordBaseUrl(getStoredOverlordBaseUrl())
    window.addEventListener('storage', refresh)
    window.addEventListener('overlord-base-url-changed', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('overlord-base-url-changed', refresh)
    }
  }, [])

  const isAdmin = me?.role === 'ADMIN' || me?.isProtected === true

  const items = isAdmin
    ? [...navItems, { href: '/admin', label: 'Admin', icon: Shield }]
    : navItems

  return (
    <aside className={cn(
      'flex-shrink-0 border-r bg-card flex flex-col transition-all duration-200',
      collapsed ? 'w-16' : 'w-60',
    )}>
      <div className={cn('h-16 flex items-center border-b', collapsed ? 'px-2 justify-center' : 'px-5 justify-between')}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <OvLogo className="w-[26px] h-[26px]" />
          </div>
          {!collapsed && <span className="font-semibold text-sm tracking-tight truncate">Overlord Tracker</span>}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className={cn('flex-1 py-4 space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && (
          <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Platform
          </p>
        )}
        {items.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + '/')
          const badge = href === '/my-tickets' && myTicketTotal > 0 ? myTicketTotal : null
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'flex items-center rounded-md py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && label}
              {!collapsed && badge !== null && (
                <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 px-1 text-[11px] font-semibold text-primary">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              {!collapsed && isActive && badge === null && (
                <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
              )}
            </Link>
          )
        })}
      </nav>

      <div className={cn('border-t', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed && overlordBaseUrl && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-1.5">
              <a
                href={buildSchemaApiUrl(overlordBaseUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="block min-w-0 flex-1 truncate text-[10px] text-muted-foreground hover:text-foreground"
                title={buildSchemaApiUrl(overlordBaseUrl)}
              >
                Schema API: {buildSchemaApiUrl(overlordBaseUrl)}
              </a>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(buildSchemaApiUrl(overlordBaseUrl))
                    setCopiedSchema(true)
                    setTimeout(() => setCopiedSchema(false), 1200)
                  } catch {
                    // Ignore clipboard failures.
                  }
                }}
                title="Copy schema API URL"
              >
                {copiedSchema ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        )}
        {!collapsed ? (
          <p className="px-3 text-[10px] text-muted-foreground">Overlord Tracker v0.1</p>
        ) : (
          <p className="text-center text-[10px] text-muted-foreground">v0.1</p>
        )}
      </div>
    </aside>
  )
}
