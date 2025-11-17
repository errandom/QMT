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
      <DialogContent className="sm:max-w-[500px] bg-white top-[10%]" style={{ color: '#001f3f' }}>
        <DialogHeader>
          <DialogTitle style={{ color: '#001f3f' }}>Request Event Cancellation</DialogTitle>
          <DialogDescription style={{ color: '#001f3f' }}>
            Submit a request to cancel: <strong>{eventTitle}</strong> on {eventDate} at {eventTime}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: '#001f3f' }}>Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
                className="bg-white"
                style={{ borderColor: '#248bcc', color: '#001f3f' }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone" style={{ color: '#001f3f' }}>Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+41 XX XXX XX XX"
                required
                className="bg-white"
                style={{ borderColor: '#248bcc', color: '#001f3f' }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="justification" style={{ color: '#001f3f' }}>Justification *</Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Please provide a detailed reason for the cancellation request..."
                rows={4}
                required
                className="bg-white"
                style={{ borderColor: '#248bcc', color: '#001f3f' }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose} 
              className="bg-[#3e4347] text-white hover:bg-[#3e4347]/90"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
