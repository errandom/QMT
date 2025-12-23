import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { Equipment, Team, User } from '@/lib/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, PencilSimple, Cube, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { COLORS } from '@/lib/constants'

interface EquipmentManagerProps {
  currentUser: User | null
}

export default function EquipmentManager({ currentUser }: EquipmentManagerProps) {
  const { equipment, setEquipment, teams } = useData()
  const [showDialog, setShowDialog] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)

  const [formData, setFormData] = useState<Partial<Equipment>>({
    name: '',
    description: '',
    quantity: 1,
    assignedTeamId: undefined
  })

  const handleCreate = () => {
    setEditingEquipment(null)
    setFormData({
      name: '',
      description: '',
      quantity: 1,
      assignedTeamId: undefined
    })
    setShowDialog(true)
  }

  const handleEdit = (eq: Equipment) => {
    setEditingEquipment(eq)
    setFormData(eq)
    setShowDialog(true)
  }

  const handleDelete = async (equipmentId: string) => {
    if (confirm('Are you sure you want to delete this equipment?')) {
      try {
        const numericId = parseInt(equipmentId)
        if (!isNaN(numericId)) {
          await api.deleteEquipment(numericId)
        }
        setEquipment((current = []) => current.filter(eq => eq.id !== equipmentId))
        toast.success('Equipment deleted successfully')
      } catch (error: any) {
        console.error('Error deleting equipment:', error)
        toast.error(error.message || 'Failed to delete equipment')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (!formData.name) {
        toast.error('Equipment name is required')
        return
      }

      const apiData = {
        name: formData.name,
        category: formData.description || null,
        quantity: formData.quantity || 1,
        condition: 'good'
      }

      if (editingEquipment) {
        const numericId = parseInt(editingEquipment.id)
        if (!isNaN(numericId)) {
          await api.updateEquipment(numericId, apiData)
        }
        setEquipment((current = []) =>
          current.map(eq => eq.id === editingEquipment.id ? { ...formData, id: editingEquipment.id } as Equipment : eq)
        )
        toast.success('Equipment updated successfully')
      } else {
        const response = await api.createEquipment(apiData)
        const newEquipment: Equipment = {
          ...formData,
          id: response.id?.toString() || `equipment-${Date.now()}`
        } as Equipment
        
        setEquipment((current = []) => [...current, newEquipment])
        toast.success('Equipment created successfully')
      }
      
      setShowDialog(false)
    } catch (error: any) {
      console.error('Error saving equipment:', error)
      toast.error(error.message || 'Failed to save equipment')
    }
  }

  const getTeamName = (teamId?: string) => {
    if (!teamId) return 'Unassigned'
    return (teams as any[]).find((t: any) => t.id === teamId)?.name || 'Unknown Team'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Equipment Management</h2>
        <Button onClick={handleCreate}>
          <Plus className="mr-2" size={16} />
          Add Equipment
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {equipment.map((eq) => (
          <Card key={eq.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2" style={{ color: COLORS.NAVY }}>
                    <Cube size={16} />
                    {eq.name}
                  </CardTitle>
                  <Badge variant="outline">Qty: {eq.quantity}</Badge>
                </div>
                {currentUser && (currentUser.role === 'admin' || currentUser.role === 'mgmt') && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#248bcc] hover:text-[#248bcc] hover:bg-[#248bcc]/10"
                      onClick={() => handleEdit(eq)}
                      title="Edit equipment"
                    >
                      <PencilSimple size={18} weight="bold" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(eq.id)}
                      title="Delete equipment"
                    >
                      <Trash size={18} weight="bold" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {eq.description && (
                <div className="text-xs" style={{ color: COLORS.CHARCOAL }}>{eq.description}</div>
              )}
              <div className="text-xs" style={{ color: COLORS.CHARCOAL }}>
                <span className="text-muted-foreground">Assigned to:</span> {getTeamName(eq.assignedTeamId)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent 
          className="w-[95vw] max-w-lg max-h-[95vh] overflow-y-auto operations-dialog p-4 sm:p-6"
          style={{
            background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)',
            border: `3px solid ${COLORS.NAVY}`,
            boxShadow: '0 20px 60px rgba(0, 31, 63, 0.3)'
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: COLORS.NAVY }}>
              {editingEquipment ? 'Edit Equipment' : 'Add Equipment'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pb-20 sm:pb-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: COLORS.CHARCOAL }}>Equipment Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" style={{ color: COLORS.CHARCOAL }}>Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity" style={{ color: COLORS.CHARCOAL }}>Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                required
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedTeam" style={{ color: COLORS.CHARCOAL }}>Assigned Team</Label>
              <Select 
                value={formData.assignedTeamId || 'unassigned'} 
                onValueChange={(v) => setFormData({ ...formData, assignedTeamId: v === 'unassigned' ? undefined : v })}
              >
                <SelectTrigger id="assignedTeam" style={{ color: COLORS.CHARCOAL }}>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(teams as any[]).filter((t: any) => t.isActive).map((team: any) => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowDialog(false)}
                className="w-full sm:w-auto min-h-[44px]"
                style={{
                  backgroundColor: COLORS.CHARCOAL,
                  color: 'white',
                  border: 'none'
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="w-full sm:w-auto min-h-[44px]"
                style={{
                  backgroundColor: COLORS.ACCENT,
                  color: 'white',
                  border: 'none'
                }}
              >
                {editingEquipment ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
