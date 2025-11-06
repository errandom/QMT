import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRequests } from '@/hooks/use-data';
import { ScheduleEvent } from '@/lib/types';
import { toast } from 'sonner';
import { XCircle } from '@phosphor-icons/react';

interface CancellationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ScheduleEvent;
}

export function CancellationRequestDialog({ open, onOpenChange, event }: CancellationRequestDialogProps) {
  const [requests, setRequests] = useRequests();
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !reason.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const newRequest = {
        id: `req-${Date.now()}`,
        type: 'cancellation' as const,
        eventId: event.id,
        requestedBy: name.trim(),
        requestedDate: event.startTime,
        description: `Cancellation request for event on ${new Date(event.startTime).toLocaleDateString()}`,
        reason: reason.trim(),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      };

      setRequests((current) => [...(current || []), newRequest]);

      toast.success('Cancellation request submitted successfully');
      
      setName('');
      setReason('');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to submit cancellation request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle size={24} weight="fill" className="text-destructive" />
            </div>
            <DialogTitle className="text-2xl">Request Cancellation</DialogTitle>
          </div>
          <DialogDescription>
            Submit a request to cancel this event. The operations office will review your request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Cancellation</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a detailed reason for the cancellation request"
              rows={5}
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
