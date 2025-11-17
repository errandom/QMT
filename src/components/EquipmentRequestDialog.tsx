import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'
import { EquipmentRequest, Team } from '@/lib/types'

interface EquipmentRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EquipmentRequestDialog({ open, onOpenChange }: EquipmentRequestDialogProps) {
  const [requests = [], setRequests] = useKV<EquipmentRequest[]>('equipment-requests', [])
  const [teams = []] = useKV<Team[]>('teams', [])
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [equipmentDescription, setEquipmentDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (selectedTeams.length === 0) {
      toast.error('Please select at least one team')
      setIsLoading(false)
      return
    }

    const newRequest: EquipmentRequest = {
      id: `eq-req-${Date.now()}`,
      requestorName: name,
      requestorPhone: phone,
      teamIds: selectedTeams,
      date,
      equipmentDescription,
      status: 'Pending',
      createdAt: new Date().toISOString()
    }

    setRequests((current) => [...(current || []), newRequest])
    toast.success('Equipment request submitted successfully')
    
    setName('')
    setPhone('')
    setSelectedTeams([])
    setDate('')
    setEquipmentDescription('')
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
            Request Equipment
          </SheetTitle>
          <SheetDescription style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            Submit a request for equipment for your team
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
            <Label style={{ color: 'white' }}>Teams * (select at least one)</Label>
            <div 
              className="grid grid-cols-2 gap-2 p-3 rounded-md max-h-40 overflow-y-auto"
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

          <div className="space-y-2">
            <Label htmlFor="date" style={{ color: 'white' }}>Date Needed *</Label>
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
            <Label htmlFor="equipment" style={{ color: 'white' }}>Equipment Description *</Label>
            <Textarea
              id="equipment"
              value={equipmentDescription}
              onChange={(e) => setEquipmentDescription(e.target.value)}
              placeholder="Describe what equipment you need and why..."
              rows={4}
              required
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