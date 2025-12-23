import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useData } from '@/contexts/DataContext'
import { EquipmentRequest, Team } from '@/lib/types'

interface EquipmentRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EquipmentRequestDialog({ open, onOpenChange }: EquipmentRequestDialogProps) {
  const { equipmentRequests, setEquipmentRequests, teams } = useData()
  
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

    setEquipmentRequests((current) => [...(current || []), newRequest])
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

  const activeTeams = (teams || [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[95vw] max-w-2xl max-h-[95vh] overflow-y-auto p-4 sm:p-8"
        style={{
          background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(162, 218, 245, 0.92) 100%)',
          backdropFilter: 'blur(16px)'
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold" style={{ color: '#001f3f' }}>
            Request Equipment
          </DialogTitle>
          <DialogDescription style={{ color: '#001f3f', opacity: 0.8 }}>
            Submit a request for equipment for your team
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: '#001f3f' }}>Name *</Label>
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
              <Label htmlFor="phone" style={{ color: '#001f3f' }}>Phone *</Label>
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
            <Label style={{ color: '#001f3f' }}>Teams * (select at least one)</Label>
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
            <Label htmlFor="date" style={{ color: '#001f3f' }}>Date Needed *</Label>
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
            <Label htmlFor="equipment" style={{ color: '#001f3f' }}>Equipment Description *</Label>
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

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto min-h-[44px]"
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
              className="w-full sm:w-auto min-h-[44px] hover:opacity-90"
              style={{
                backgroundColor: '#248bcc',
                color: 'white',
                border: 'none'
              }}
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
