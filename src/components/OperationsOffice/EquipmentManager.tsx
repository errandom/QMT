import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Equipment, Team } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, PencilSimple, Cube } from '@phosphor-icons/react'
import { toast } from 'sonner'

export default function EquipmentManager() {
  const [equipment = [], setEquipment] = useKV<Equipment[]>('equipment', [])
  const [teams = []] = useKV<Team[]>('teams', [])
  const [showDialog, setShowDialog] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)

  const [formData, setFormData] = useState<Partial<Equipment>>({
    name: '',
    description: '',
    quantity: 1,
    assignedTeamId: ''
  })

  const handleCreate = () => {
    setEditingEquipment(null)
    setFormData({
      name: '',
      description: '',
      quantity: 1,
      assignedTeamId: ''
    })
    setShowDialog(true)
  }

  const handleEdit = (eq: Equipment) => {
    setEditingEquipment(eq)
    setFormData(eq)
    setShowDialog(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingEquipment) {
      setEquipment((current = []) =>
        current.map(eq => eq.id === editingEquipment.id ? { ...formData, id: editingEquipment.id } as Equipment : eq)
      )
      toast.success('Equipment updated successfully')
    } else {
      const newEquipment: Equipment = {
        ...formData,
        id: `equipment-${Date.now()}`
      } as Equipment
      
      setEquipment((current = []) => [...current, newEquipment])
      toast.success('Equipment created successfully')
    }
    
    setShowDialog(false)
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
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cube size={16} />
                    {eq.name}
                  </CardTitle>
                  <Badge variant="outline">Qty: {eq.quantity}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(eq)}
                >
                  <PencilSimple size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {eq.description && (
                <div className="text-muted-foreground text-xs">{eq.description}</div>
              )}
              <div className="text-xs">
                <span className="text-muted-foreground">Assigned to:</span> {getTeamName(eq.assignedTeamId)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEquipment ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Equipment Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedTeam">Assigned Team</Label>
              <Select value={formData.assignedTeamId} onValueChange={(v) => setFormData({ ...formData, assignedTeamId: v })}>
                <SelectTrigger id="assignedTeam">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {(teams as any[]).filter((t: any) => t.isActive).map((team: any) => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEquipment ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}