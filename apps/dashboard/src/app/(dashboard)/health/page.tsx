import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function HealthPage() {
  return (
    <div className="p-8 max-w-lg mx-auto">
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Construction className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Coming soon</h2>
            <p className="text-sm text-muted-foreground">
              Service health monitoring is on the roadmap.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

