import { useState } from 'react'
import { Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useData } from '@/contexts/DataContext'
import { api } from '@/lib/api'
import type { FacilityRequest, EquipmentRequest, CancellationRequest } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog'

export default function RequestDeleteButton({ request }: {
  request: FacilityRequest | EquipmentRequest | CancellationRequest
}) {
  const { setFacilityRequests, setEquipmentRequests, setCancellationRequests } = useData()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api.deleteRequest(request.id, request.status,
        'eventType' in request ? request.workflow?.version || 0 : undefined)
      setOpen(false)
      setFacilityRequests(current => current.filter(item => item.id !== request.id))
      setEquipmentRequests(current => current.filter(item => item.id !== request.id))
      setCancellationRequests(current => current.filter(item => item.id !== request.id))
      toast.success('Request deleted. Existing bookings were not changed.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Request could not be deleted'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={value => {
      if (busy) return
      setOpen(value)
      setError('')
    }}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive"
          aria-label={`Delete request #${request.id} from ${request.requestorName}`}>
          <Trash size={16} className="mr-1" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="text-foreground" aria-busy={busy}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete request #{request.id}?</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            Permanently delete this {request.status.toLowerCase()} request from {request.requestorName}
            {' '}and its linked QMT message history? This cannot be undone.
            Existing bookings and event statuses will not change. No notification will be sent,
            and emails already sent will not be recalled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={handleDelete}>
            {busy ? 'Deleting...' : 'Delete request'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
