import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'
import { FacilityRequest, EventType, Team } from '@/lib/types'

interface FacilityRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function FacilityRequestDialog({ open, onOpenChange }: FacilityRequestDialogProps) {
  const [requests = [], setRequests] = useKV<FacilityRequest[]>('facility-requests', [])
  const [teams = []] = useKV<Team[]>('teams', [])
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [eventType, setEventType] = useState<EventType | ''>('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [purpose, setPurpose] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('90')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (!eventType) {
      toast.error('Please select an event type')
      setIsLoading(false)
      return
    }

    if ((eventType === 'Game' || eventType === 'Practice') && selectedTeams.length === 0) {
      toast.error('Please select at least one team for game/practice')
      setIsLoading(false)
      return
    }

    if (eventType !== 'Game' && eventType !== 'Practice' && !purpose) {
      toast.error('Please specify the purpose')
      setIsLoading(false)
      return
    }

    const newRequest: FacilityRequest = {
      id: `req-${Date.now()}`,
      requestorName: name,
      requestorPhone: phone,
      eventType: eventType as EventType,
      teamIds: selectedTeams.length > 0 ? selectedTeams : undefined,
      purpose: purpose || undefined,
      date,
      startTime,
      duration: parseInt(duration),
      description: description || undefined,
      status: 'Pending',
      createdAt: new Date().toISOString()
    }

    setRequests((current) => [...(current || []), newRequest])
    toast.success('Facility request submitted successfully')
    
    setName('')
    setPhone('')
    setEventType('')
    setSelectedTeams([])
    setPurpose('')
    setDate('')
    setStartTime('')
    setDuration('90')
    setDescription('')
    setIsLoading(false)
    onOpenChange(false)
  }

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeams((current) =>
      current.includes(teamId)
        ? current.filter(id => id !== teamId)
        : [...current, teamId]
    )
  }

  const activeTeams = (teams || []).filter(t => t.isActive)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Facility</DialogTitle>
          <DialogDescription>
            Submit a request to book a facility for your team or event
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-type">Event Type *</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger id="event-type">
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Game">Game</SelectItem>
                <SelectItem value="Practice">Practice</SelectItem>
                <SelectItem value="Meeting">Meeting</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(eventType === 'Game' || eventType === 'Practice') && (
            <div className="space-y-2">
              <Label>Teams * (select at least one)</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-32 overflow-y-auto">
                {activeTeams.map(team => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`team-${team.id}`}
                      checked={selectedTeams.includes(team.id)}
                      onCheckedChange={() => handleTeamToggle(team.id)}
                    />
                    <label
                      htmlFor={`team-${team.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {team.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {eventType && eventType !== 'Game' && eventType !== 'Practice' && (
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose *</Label>
              <Input
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Specify the purpose"
                required
              />
            </div>
          )}

          {(eventType === 'Meeting' || eventType === 'Other') && activeTeams.length > 0 && (
            <div className="space-y-2">
              <Label>Teams (optional)</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-32 overflow-y-auto">
                {activeTeams.map(team => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`team-opt-${team.id}`}
                      checked={selectedTeams.includes(team.id)}
                      onCheckedChange={() => handleTeamToggle(team.id)}
                    />
                    <label
                      htmlFor={`team-opt-${team.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {team.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time *</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (min) *</Label>
              <Input
                id="duration"
                type="number"
                min={(eventType === 'Game' || eventType === 'Practice') ? 90 : 30}
                step="30"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional Details</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional context or special requirements..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} style={{
              borderColor: '#3e4347',
              color: '#2c3e50'
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-[#3e4347] hover:opacity-90 text-white">
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}