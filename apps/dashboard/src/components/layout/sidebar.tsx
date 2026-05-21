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
  X,
} from 'lucide-react'
import { OvLogo } from '@/components/logo'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { buildSchemaApiUrl, getStoredOverlordBaseUrl } from '@/lib/overlord-links'
import { useQuery } from '@tanstack/react-query'
import type { UserSummary } from '@platform/shared-types'
import { useSidebar } from './sidebar-context'

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
  const { mobileOpen, setMobileOpen } = useSidebar()
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<UserSummary>('/users/me'),
  })

  const { data: myTicketsData } = useQuery({
    queryKey: ['my-tickets-count', me?.id],
    queryFn: () => api.get<{ total: number }>(`/tickets?assigneeId=${me!.id}&pageSize=1`),
    enabled: !!me?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  const myTicketTotal = myTicketsData?.total ?? 0

  // Count unseen tickets assigned to the current user (client-side, localStorage).
  const [unseenCount, setUnseenCount] = useState(0)
  useEffect(() => {
    const update = () => {
      if (!me?.id) { setUnseenCount(0); return }
      try {
        const map = JSON.parse(localStorage.getItem('overlord.unseenTickets') ?? '{}') as Record<string, string>
        setUnseenCount(Object.values(map).filter((id) => id === me.id).length)
      } catch {
        setUnseenCount(0)
      }
    }
    update()
    window.addEventListener('ticket-activity-changed', update)
    return () => window.removeEventListener('ticket-activity-changed', update)
  }, [me?.id])

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

  // Close the mobile drawer whenever the user navigates to a new page.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  // Shared nav-item renderer used by both desktop and mobile.
  function renderNavItem(
    { href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType },
    opts: { collapsed?: boolean; onClose?: () => void },
  ) {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    const badge = href === '/my-tickets' && myTicketTotal > 0 ? myTicketTotal : null
    const hasUnseen = href === '/my-tickets' && unseenCount > 0
    const col = opts.collapsed ?? false
    return (
      <Link
        key={href}
        href={href}
        title={label}
        onClick={opts.onClose}
        className={cn(
          'flex items-center rounded-md py-2 text-sm font-medium transition-colors',
          col ? 'justify-center px-2' : 'gap-3 px-3',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <span className="relative flex-shrink-0">
          <Icon className="h-4 w-4" />
          {col && badge !== null && (
            <span className={cn(
              'absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none',
              hasUnseen
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-primary text-primary-foreground',
            )}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        {!col && label}
        {!col && badge !== null && (
          <span className={cn(
            'ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold',
            hasUnseen
              ? 'bg-destructive/15 text-destructive'
              : 'bg-primary/15 text-primary',
          )}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        {!col && isActive && badge === null && (
          <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
        )}
      </Link>
    )
  }

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ──────────────────────────────── */}
      <aside className={cn(
        'hidden md:flex flex-shrink-0 border-r bg-card flex-col transition-all duration-200',
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
          {items.map((item) => renderNavItem(item, { collapsed }))}
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

      {/* ── Mobile slide-in drawer (hidden on md+) ──────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-50 md:hidden transition-all duration-300',
          mobileOpen ? 'visible' : 'invisible pointer-events-none',
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity duration-300',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileOpen(false)}
        />
        {/* Panel */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-72 bg-card flex flex-col shadow-xl transition-transform duration-300',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="h-16 flex items-center justify-between px-5 border-b flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                <OvLogo className="w-[26px] h-[26px]" />
              </div>
              <span className="font-semibold text-sm tracking-tight">Overlord Tracker</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
            <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Platform
            </p>
            {items.map((item) => renderNavItem(item, { onClose: () => setMobileOpen(false) }))}
          </nav>

          <div className="border-t p-3 flex-shrink-0">
            {overlordBaseUrl && (
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
            <p className="px-3 text-[10px] text-muted-foreground">Overlord Tracker v0.1</p>
          </div>
        </div>
      </div>
    </>
  )
}
