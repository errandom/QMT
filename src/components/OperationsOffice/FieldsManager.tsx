import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { Field, Site, TurfType, FieldSize, User } from '@/lib/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Plus, PencilSimple, GridFour, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { COLORS } from '@/lib/constants'

interface FieldsManagerProps {
  currentUser: User | null
}

export default function FieldsManager({ currentUser }: FieldsManagerProps) {
  const { fields, setFields, sites } = useData()
  const [showDialog, setShowDialog] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)

  const [formData, setFormData] = useState<Partial<Field>>({
    name: '',
    siteId: '',
    turfType: 'Natural Turf',
    hasLights: false,
    fieldSize: 'Full',
    capacity: undefined,
    isActive: true
  })

  const activeSportsSites = sites.filter(s => s.isActive && s.isSportsFacility)

  const handleCreate = () => {
    setEditingField(null)
    setFormData({
      name: '',
      siteId: '',
      turfType: 'Natural Turf',
      hasLights: false,
      fieldSize: 'Full',
      capacity: undefined,
      isActive: true
    })
    setShowDialog(true)
  }

  const handleEdit = (field: Field) => {
    setEditingField(field)
    setFormData(field)
    setShowDialog(true)
  }

  const handleDelete = async (fieldId: string) => {
    if (confirm('Are you sure you want to delete this field?')) {
      try {
        const numericId = parseInt(fieldId)
        if (!isNaN(numericId)) {
          await api.deleteField(numericId)
        }
        setFields((current = []) => current.filter(f => f.id !== fieldId))
        toast.success('Field deleted successfully')
      } catch (error: any) {
        console.error('Error deleting field:', error)
        toast.error(error.message || 'Failed to delete field')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (!formData.name || !formData.siteId) {
        toast.error('Field name and site are required')
        return
      }

      const apiData = {
        name: formData.name,
        site_id: parseInt(formData.siteId),
        field_type: formData.turfType || null,
        surface_type: formData.fieldSize || null
      }

      if (editingField) {
        const numericId = parseInt(editingField.id)
        if (!isNaN(numericId)) {
          await api.updateField(numericId, apiData)
        }
        setFields((current = []) =>
          current.map(f => f.id === editingField.id ? { ...formData, id: editingField.id } as Field : f)
        )
        toast.success('Field updated successfully')
      } else {
        const response = await api.createField(apiData)
        const newField: Field = {
          ...formData,
          id: response.id?.toString() || `field-${Date.now()}`
        } as Field
        
        setFields((current = []) => [...current, newField])
        toast.success('Field created successfully')
      }
      
      setShowDialog(false)
    } catch (error: any) {
      console.error('Error saving field:', error)
      toast.error(error.message || 'Failed to save field')
    }
  }

  const getSiteName = (siteId: string) => {
    return sites.find(s => s.id === siteId)?.name || 'Unknown Site'
  }

  const handleToggleActive = (fieldId: string, currentActive: boolean) => {
    setFields((current = []) =>
      current.map(f => f.id === fieldId ? { ...f, isActive: !currentActive } : f)
    )
    toast.success(`Field ${currentActive ? 'deactivated' : 'activated'} successfully`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Fields Management</h2>
        <Button onClick={handleCreate} disabled={activeSportsSites.length === 0}>
          <Plus className="mr-2" size={16} />
          Add Field
        </Button>
      </div>

      {activeSportsSites.length === 0 && (
        <div className="text-sm text-muted-foreground p-4 border rounded-lg">
          Create an active sports facility first before adding fields.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <Card key={field.id} className={!field.isActive ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2" style={{ color: COLORS.NAVY }}>
                    <GridFour size={16} />
                    {field.name}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">{getSiteName(field.siteId)}</div>
                  <Badge variant={field.isActive ? 'default' : 'destructive'} className="text-xs">
                    {field.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {currentUser && (currentUser.role === 'admin' || currentUser.role === 'mgmt') && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#248bcc] hover:text-[#248bcc] hover:bg-[#248bcc]/10"
                      onClick={() => handleEdit(field)}
                      title="Edit field"
                    >
                      <PencilSimple size={18} weight="bold" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(field.id)}
                      title="Delete field"
                    >
                      <Trash size={18} weight="bold" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">{field.turfType}</Badge>
                <Badge variant="outline" className="text-xs">{field.fieldSize} Field</Badge>
                {field.hasLights && <Badge variant="outline" className="text-xs">Lights</Badge>}
                {field.capacity && <Badge variant="outline" className="text-xs">Cap: {field.capacity}</Badge>}
              </div>
              {currentUser && (currentUser.role === 'admin' || currentUser.role === 'mgmt') && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs font-medium" style={{ color: COLORS.CHARCOAL }}>Status</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: COLORS.CHARCOAL }}>
                      {field.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Switch
                      checked={field.isActive}
                      onCheckedChange={() => handleToggleActive(field.id, field.isActive)}
                      style={{
                        backgroundColor: field.isActive ? COLORS.NAVY : undefined
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent 
          className="max-w-lg operations-dialog"
          style={{
            background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)',
            border: `3px solid ${COLORS.NAVY}`,
            boxShadow: '0 20px 60px rgba(0, 31, 63, 0.3)'
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: COLORS.NAVY }}>
              {editingField ? 'Edit Field' : 'Create Field'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: COLORS.CHARCOAL }}>Field Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="site" style={{ color: COLORS.CHARCOAL }}>Site *</Label>
              <Select 
                value={formData.siteId || ''} 
                onValueChange={(v) => setFormData({ ...formData, siteId: v })}
                required
              >
                <SelectTrigger id="site" style={{ color: COLORS.CHARCOAL }}>
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {activeSportsSites.map(site => (
                    <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="turfType" style={{ color: COLORS.CHARCOAL }}>Turf Type *</Label>
                <Select 
                  value={formData.turfType || 'Natural Turf'} 
                  onValueChange={(v) => setFormData({ ...formData, turfType: v as TurfType })}
                  required
                >
                  <SelectTrigger id="turfType" style={{ color: COLORS.CHARCOAL }}>
                    <SelectValue placeholder="Select turf type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Natural Turf">Natural Turf</SelectItem>
                    <SelectItem value="Artificial Turf">Artificial Turf</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fieldSize" style={{ color: COLORS.CHARCOAL }}>Field Size *</Label>
                <Select 
                  value={formData.fieldSize || 'Full'} 
                  onValueChange={(v) => setFormData({ ...formData, fieldSize: v as FieldSize })}
                  required
                >
                  <SelectTrigger id="fieldSize" style={{ color: COLORS.CHARCOAL }}>
                    <SelectValue placeholder="Select field size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full">Full</SelectItem>
                    <SelectItem value="Shared">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity" style={{ color: COLORS.CHARCOAL }}>Capacity (optional)</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity || ''}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value ? parseInt(e.target.value) : undefined })}
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="hasLights"
                  checked={formData.hasLights}
                  onCheckedChange={(checked) => setFormData({ ...formData, hasLights: checked })}
                  style={{
                    backgroundColor: formData.hasLights ? COLORS.NAVY : undefined
                  }}
                />
                <Label htmlFor="hasLights" style={{ color: COLORS.CHARCOAL }}>Has Lights</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  style={{
                    backgroundColor: formData.isActive ? COLORS.NAVY : undefined
                  }}
                />
                <Label htmlFor="isActive" style={{ color: COLORS.CHARCOAL }}>Active</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowDialog(false)}
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
                style={{
                  backgroundColor: COLORS.ACCENT,
                  color: 'white',
                  border: 'none'
                }}
              >
                {editingField ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
