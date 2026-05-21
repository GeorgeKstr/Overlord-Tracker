import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ApiOfflineStateProps {
  onRetry?: () => void
  className?: string
}

/**
 * Full-area empty state shown when the API service is unreachable.
 * Use this in place of inline destructive error boxes for query-level
 * network failures.
 */
export function ApiOfflineState({ onRetry, className }: ApiOfflineStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 text-center gap-3 ${className ?? ''}`}>
      <WifiOff className="h-10 w-10 text-muted-foreground/40" />
      <div>
        <h3 className="font-medium text-base">API is unreachable</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
          The API service appears to be offline or unreachable. Check that it is running and try again.
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  )
}
