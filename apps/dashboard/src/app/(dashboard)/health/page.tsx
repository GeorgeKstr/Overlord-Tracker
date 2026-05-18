'use client'

import { useQuery } from '@tanstack/react-query'
import { Activity, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import type { Service } from '@platform/shared-types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG = {
  HEALTHY: {
    icon: CheckCircle2,
    color: 'text-green-500',
    badge: 'success' as const,
    label: 'Healthy',
  },
  DEGRADED: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    badge: 'warning' as const,
    label: 'Degraded',
  },
  DOWN: {
    icon: XCircle,
    color: 'text-red-500',
    badge: 'destructive' as const,
    label: 'Down',
  },
  UNKNOWN: {
    icon: HelpCircle,
    color: 'text-slate-400',
    badge: 'outline' as const,
    label: 'Unknown',
  },
}

export default function HealthDashboardPage() {
  const { data: services = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<Service[]>('/services'),
    refetchInterval: 30_000,
  })

  const { data: apiHealth } = useQuery({
    queryKey: ['api-health'],
    queryFn: () =>
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/health`,
      ).then((r) => r.json() as Promise<{ status: string; uptime: number }>),
    refetchInterval: 15_000,
  })

  const summary = services.reduce(
    (acc, svc) => {
      acc[svc.status] = (acc[svc.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const overallStatus =
    (summary.DOWN ?? 0) > 0
      ? 'DOWN'
      : (summary.DEGRADED ?? 0) > 0
      ? 'DEGRADED'
      : (summary.HEALTHY ?? 0) > 0
      ? 'HEALTHY'
      : 'UNKNOWN'

  const OverallIcon = STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG].icon

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Health Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Last updated: {dataUpdatedAt ? formatDate(new Date(dataUpdatedAt)) : '—'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <OverallIcon
                className={`h-8 w-8 ${STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG].color}`}
              />
              <div>
                <p className="text-sm text-muted-foreground">Overall Status</p>
                <p className="text-2xl font-bold">
                  {STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG].label}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <Card key={status}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <config.icon className={`h-4 w-4 ${config.color}`} />
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
              <p className="text-2xl font-semibold">{summary[status] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              API Server
            </CardTitle>
          </CardHeader>
          <CardContent>
            {apiHealth ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="success">
                    {apiHealth.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uptime</span>
                  <span>{Math.floor(apiHealth.uptime / 60)} minutes</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Checking…</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-base font-medium mb-3">All Services</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No services registered yet.
          </div>
        ) : (
          <div className="border rounded-lg divide-y overflow-hidden">
            {services.map((service) => {
              const config =
                STATUS_CONFIG[service.status as keyof typeof STATUS_CONFIG]
              const Icon = config.icon
              return (
                <div
                  key={service.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50"
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{service.name}</p>
                    <code className="text-xs text-muted-foreground">{service.slug}</code>
                  </div>
                  <Badge variant={config.badge}>{config.label}</Badge>
                  {service.baseUrl && (
                    <a
                      href={service.healthUrl ?? service.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground hidden md:block max-w-[200px] truncate"
                    >
                      {service.healthUrl ?? service.baseUrl}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
