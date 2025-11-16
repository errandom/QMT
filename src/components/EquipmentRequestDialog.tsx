import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Equipment</DialogTitle>
          <DialogDescription>
            Submit a request for equipment for your team
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
            <Label>Teams * (select at least one)</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-40 overflow-y-auto">
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

          <div className="space-y-2">
            <Label htmlFor="date">Date Needed *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment">Equipment Description *</Label>
            <Textarea
              id="equipment"
              value={equipmentDescription}
              onChange={(e) => setEquipmentDescription(e.target.value)}
              placeholder="Describe what equipment you need and why..."
              rows={4}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} style={{
              borderColor: '#001f3f',
              color: '#2c3e50'
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} style={{
              background: 'linear-gradient(90deg, #001f3f 0%, #248bcc 100%)',
              color: '#f5f5f5'
            }}>
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}