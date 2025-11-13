import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useKV } from '@github/spark/hooks'
import { CancellationRequest } from '@/lib/types'
import { toast } from 'sonner'

interface CancellationRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  eventTitle: string
  eventDate: string
  eventTime: string
}

export default function CancellationRequestDialog({ 
  open, 
  onOpenChange,
  eventId,
  eventTitle,
  eventDate,
  eventTime
}: CancellationRequestDialogProps) {
  const [, setCancellationRequests] = useKV<CancellationRequest[]>('cancellation-requests', [])
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [justification, setJustification] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !phone.trim() || !justification.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmitting(true)

    const newRequest: CancellationRequest = {
      id: Date.now().toString(),
      requestorName: name.trim(),
      requestorPhone: phone.trim(),
      eventId,
      eventTitle,
      eventDate,
      eventTime,
      justification: justification.trim(),
      status: 'Pending',
      createdAt: new Date().toISOString()
    }

    setCancellationRequests((current = []) => [...current, newRequest])
    
    toast.success('Cancellation request submitted')
    setIsSubmitting(false)
    handleClose()
  }

  const handleClose = () => {
    setName('')
    setPhone('')
    setJustification('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Event Cancellation</DialogTitle>
          <DialogDescription>
            Submit a request to cancel: <strong>{eventTitle}</strong> on {eventDate} at {eventTime}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+41 XX XXX XX XX"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="justification">Justification *</Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Please provide a detailed reason for the cancellation request..."
                rows={4}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
