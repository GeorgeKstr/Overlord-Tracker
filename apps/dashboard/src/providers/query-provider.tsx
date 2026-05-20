'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Query } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

function getAutoRefreshInterval(query: Query): number | false {
  const [rootKey] = query.queryKey
  if (typeof rootKey !== 'string') return false

  // Keep high-signal, collaboration-heavy screens fresh without over-polling everything.
  if (rootKey === 'tickets' || rootKey === 'projects') return 10_000
  if (rootKey === 'services' || rootKey === 'members' || rootKey === 'labels') return 20_000
  return false
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchInterval: getAutoRefreshInterval,
            refetchIntervalInBackground: true,
            refetchOnWindowFocus: true,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
