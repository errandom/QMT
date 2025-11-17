import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right"
        className="overflow-y-auto w-full sm:max-w-2xl"
        style={{
          backgroundColor: 'rgba(0, 31, 63, 0.85)',
          color: 'white',
          border: 'none',
          padding: '2rem'
        }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: 'white', fontSize: '1.5rem', fontWeight: '600' }}>
            Request Facility
          </SheetTitle>
          <SheetDescription style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            Submit a request to book a facility for your team or event
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: 'white' }}>Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  borderColor: '#248bcc',
                  backgroundColor: 'white',
                  color: 'oklch(0.28 0.005 240)'
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" style={{ color: 'white' }}>Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={{
                  borderColor: '#248bcc',
                  backgroundColor: 'white',
                  color: 'oklch(0.28 0.005 240)'
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-type" style={{ color: 'white' }}>Event Type *</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger 
                id="event-type"
                className="!bg-white !text-[oklch(0.28_0.005_240)] !border-[#248bcc] hover:!bg-white focus:!bg-white data-[placeholder]:!text-[oklch(0.28_0.005_240)] [&_svg]:!text-[oklch(0.28_0.005_240)]"
                style={{
                  boxShadow: 'none',
                  backdropFilter: 'none'
                }}
              >
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent 
                className="!bg-white !text-[oklch(0.28_0.005_240)] !border-[#248bcc]"
                style={{
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  backdropFilter: 'none'
                }}
              >
                <SelectItem value="Game" className="!text-[oklch(0.28_0.005_240)] hover:!bg-[#248bcc]/10 focus:!bg-[#248bcc] focus:!text-white data-[highlighted]:!bg-[#248bcc] data-[highlighted]:!text-white">Game</SelectItem>
                <SelectItem value="Practice" className="!text-[oklch(0.28_0.005_240)] hover:!bg-[#248bcc]/10 focus:!bg-[#248bcc] focus:!text-white data-[highlighted]:!bg-[#248bcc] data-[highlighted]:!text-white">Practice</SelectItem>
                <SelectItem value="Meeting" className="!text-[oklch(0.28_0.005_240)] hover:!bg-[#248bcc]/10 focus:!bg-[#248bcc] focus:!text-white data-[highlighted]:!bg-[#248bcc] data-[highlighted]:!text-white">Meeting</SelectItem>
                <SelectItem value="Other" className="!text-[oklch(0.28_0.005_240)] hover:!bg-[#248bcc]/10 focus:!bg-[#248bcc] focus:!text-white data-[highlighted]:!bg-[#248bcc] data-[highlighted]:!text-white">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(eventType === 'Game' || eventType === 'Practice') && (
            <div className="space-y-2">
              <Label style={{ color: 'white' }}>Teams * (select at least one)</Label>
              <div 
                className="grid grid-cols-2 gap-2 p-3 rounded-md max-h-32 overflow-y-auto"
                style={{
                  border: '1px solid #248bcc',
                  backgroundColor: 'white'
                }}
              >
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
                      style={{ color: 'oklch(0.28 0.005 240)' }}
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
              <Label htmlFor="purpose" style={{ color: 'white' }}>Purpose *</Label>
              <Input
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Specify the purpose"
                required
                style={{
                  borderColor: '#248bcc',
                  backgroundColor: 'white',
                  color: 'oklch(0.28 0.005 240)'
                }}
              />
            </div>
          )}

          {(eventType === 'Meeting' || eventType === 'Other') && activeTeams.length > 0 && (
            <div className="space-y-2">
              <Label style={{ color: 'white' }}>Teams (optional)</Label>
              <div 
                className="grid grid-cols-2 gap-2 p-3 rounded-md max-h-32 overflow-y-auto"
                style={{
                  border: '1px solid #248bcc',
                  backgroundColor: 'white'
                }}
              >
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
                      style={{ color: 'oklch(0.28 0.005 240)' }}
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
              <Label htmlFor="date" style={{ color: 'white' }}>Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{
                  borderColor: '#248bcc',
                  backgroundColor: 'white',
                  color: 'oklch(0.28 0.005 240)'
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-time" style={{ color: 'white' }}>Start Time *</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                style={{
                  borderColor: '#248bcc',
                  backgroundColor: 'white',
                  color: 'oklch(0.28 0.005 240)'
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration" style={{ color: 'white' }}>Duration (min) *</Label>
              <Input
                id="duration"
                type="number"
                min={(eventType === 'Game' || eventType === 'Practice') ? 90 : 30}
                step="30"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                style={{
                  borderColor: '#248bcc',
                  backgroundColor: 'white',
                  color: 'oklch(0.28 0.005 240)'
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" style={{ color: 'white' }}>Additional Details</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional context or special requirements..."
              rows={3}
              style={{
                borderColor: '#248bcc',
                backgroundColor: 'white',
                color: 'oklch(0.28 0.005 240)'
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              style={{
                borderColor: '#3e4347',
                backgroundColor: 'white',
                color: '#3e4347'
              }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              style={{
                backgroundColor: '#248bcc',
                color: 'white',
                border: 'none'
              }}
              className="hover:opacity-90"
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}