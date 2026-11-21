import { Button } from '@/components/ui/button'

export default function TemplateDraftStatus({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (error) return <div role="alert" className="space-y-2 text-sm text-destructive">
    <p>{error}. Sending is paused until a valid draft can be prepared. Retry, or correct the template/request details.</p>
    <Button type="button" variant="outline" onClick={retry}>Retry template library</Button>
  </div>
  return loading ? <p role="status" className="text-sm text-muted-foreground">Loading message templates...</p> : null
}
