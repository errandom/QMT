import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { Field, Site, TurfType, FieldSize, User, LocationType } from '@/lib/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, PencilSimple, GridFour, Trash, Buildings } from '@phosphor-icons/react'
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
    siteId: undefined,
    locationType: 'field',
    turfType: 'Natural Turf',
    hasLights: false,
    fieldSize: 'Full',
    capacity: undefined,
    isActive: true
  })

  const activeSportsSites = sites.filter(s => s.isActive && s.isSportsFacility)
  const activeNonSportsSites = sites.filter(s => s.isActive && !s.isSportsFacility)
  const hasAvailableSites = activeSportsSites.length > 0 || activeNonSportsSites.length > 0

  // Get available sites based on location type
  const getAvailableSites = (locationType: LocationType) => {
    if (locationType === 'field') {
      return activeSportsSites
    }
    return activeNonSportsSites
  }

  const handleCreate = () => {
    setEditingField(null)
    // Default to field if sports sites available, otherwise meeting room
    const defaultType: LocationType = activeSportsSites.length > 0 ? 'field' : 'meeting_room'
    setFormData({
      name: '',
      siteId: undefined,
      locationType: defaultType,
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
    setFormData({
      ...field,
      locationType: field.locationType || 'field'
    })
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
        toast.error('Name and site are required')
        return
      }

      const isField = formData.locationType === 'field'

      const apiData = {
        site_id: parseInt(formData.siteId),
        name: formData.name,
        location_type: formData.locationType || 'field',
        field_type: isField ? (formData.turfType || null) : null,
        surface_type: isField ? (formData.fieldSize || null) : null,
        has_lights: isField ? (formData.hasLights || false) : false,
        capacity: formData.capacity || null,
        active: formData.isActive !== false
      }

      console.log('FIELDS FRONTEND: Submitting field data:', apiData)

      if (editingField) {
        const numericId = parseInt(editingField.id)
        if (!isNaN(numericId)) {
          await api.updateField(numericId, apiData)
        }
        setFields((current = []) =>
          current.map(f => f.id === editingField.id ? { ...formData, id: editingField.id } as Field : f)
        )
        toast.success(`${isField ? 'Field' : 'Meeting room'} updated successfully`)
      } else {
        const response = await api.createField(apiData)
        const newField: Field = {
          ...formData,
          id: response.id?.toString() || `field-${Date.now()}`
        } as Field
        
        setFields((current = []) => [...current, newField])
        toast.success(`${isField ? 'Field' : 'Meeting room'} created successfully`)
      }
      
      setShowDialog(false)
    } catch (error: any) {
      console.error('Error saving:', error)
      toast.error(error.message || 'Failed to save')
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
        <h2 className="text-xl font-semibold">Fields & Meeting Rooms</h2>
        <Button onClick={handleCreate} disabled={!hasAvailableSites}>
          <Plus className="mr-2" size={16} />
          Add Location
        </Button>
      </div>

      {!hasAvailableSites && (
        <div className="text-sm text-muted-foreground p-4 border rounded-lg">
          Create an active site first before adding fields or meeting rooms.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => {
          const isField = field.locationType !== 'meeting_room'
          return (
          <Card key={field.id} className={!field.isActive ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2" style={{ color: COLORS.NAVY }}>
                    {isField ? <GridFour size={16} /> : <Buildings size={16} />}
                    {field.name}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">{getSiteName(field.siteId)}</div>
                  <div className="flex gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {isField ? 'Field' : 'Meeting Room'}
                    </Badge>
                    <Badge variant={field.isActive ? 'default' : 'destructive'} className="text-xs">
                      {field.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
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
                {isField && field.turfType && <Badge variant="outline" className="text-xs">{field.turfType}</Badge>}
                {isField && field.fieldSize && <Badge variant="outline" className="text-xs">{field.fieldSize} Field</Badge>}
                {isField && field.hasLights && <Badge variant="outline" className="text-xs">Lights</Badge>}
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
          )
        })}
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
              {editingField 
                ? `Edit ${formData.locationType === 'meeting_room' ? 'Meeting Room' : 'Field'}` 
                : `Create ${formData.locationType === 'meeting_room' ? 'Meeting Room' : 'Field'}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pb-20 sm:pb-4">
            {/* Location Type Selection - only show when creating and both site types exist */}
            {!editingField && activeSportsSites.length > 0 && activeNonSportsSites.length > 0 && (
              <div className="space-y-2">
                <Label style={{ color: COLORS.CHARCOAL }}>Location Type *</Label>
                <RadioGroup
                  value={formData.locationType || 'field'}
                  onValueChange={(v) => setFormData({ 
                    ...formData, 
                    locationType: v as LocationType,
                    siteId: undefined // Reset site when changing type
                  })}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="field" id="type-field" />
                    <Label htmlFor="type-field" className="flex items-center gap-2 cursor-pointer" style={{ color: COLORS.CHARCOAL }}>
                      <GridFour size={18} />
                      Field
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="meeting_room" id="type-meeting" />
                    <Label htmlFor="type-meeting" className="flex items-center gap-2 cursor-pointer" style={{ color: COLORS.CHARCOAL }}>
                      <Buildings size={18} />
                      Meeting Room
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: COLORS.CHARCOAL }}>
                {formData.locationType === 'meeting_room' ? 'Room Name' : 'Field Name'} *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.locationType === 'meeting_room' ? 'e.g. Conference Room A' : 'e.g. Main Field'}
                required
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="site" style={{ color: COLORS.CHARCOAL }}>
                {formData.locationType === 'meeting_room' ? 'Building/Site' : 'Sports Facility'} *
              </Label>
              <Select 
                value={formData.siteId || ''} 
                onValueChange={(v) => setFormData({ ...formData, siteId: v })}
              >
                <SelectTrigger 
                  id="site" 
                  className="bg-white border-gray-300 text-[#2C3E50] data-[placeholder]:text-gray-500"
                >
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {getAvailableSites(formData.locationType || 'field').map(site => (
                    <SelectItem 
                      key={site.id} 
                      value={site.id}
                      className="text-[#2C3E50] focus:bg-[#248bcc] focus:text-white"
                    >
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field-specific options - only show for fields */}
            {formData.locationType !== 'meeting_room' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="turfType" style={{ color: COLORS.CHARCOAL }}>Turf Type *</Label>
                <Select 
                  value={formData.turfType || 'Natural Turf'} 
                  onValueChange={(v) => setFormData({ ...formData, turfType: v as TurfType })}
                >
                  <SelectTrigger 
                    id="turfType" 
                    className="bg-white border-gray-300 text-[#2C3E50] data-[placeholder]:text-gray-500"
                  >
                    <SelectValue placeholder="Select turf type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem 
                      value="Natural Turf"
                      className="text-[#2C3E50] focus:bg-[#248bcc] focus:text-white"
                    >
                      Natural Turf
                    </SelectItem>
                    <SelectItem 
                      value="Artificial Turf"
                      className="text-[#2C3E50] focus:bg-[#248bcc] focus:text-white"
                    >
                      Artificial Turf
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fieldSize" style={{ color: COLORS.CHARCOAL }}>Field Size *</Label>
                <Select 
                  value={formData.fieldSize || 'Full'} 
                  onValueChange={(v) => setFormData({ ...formData, fieldSize: v as FieldSize })}
                >
                  <SelectTrigger 
                    id="fieldSize" 
                    className="bg-white border-gray-300 text-[#2C3E50] data-[placeholder]:text-gray-500"
                  >
                    <SelectValue placeholder="Select field size" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem 
                      value="Full"
                      className="text-[#2C3E50] focus:bg-[#248bcc] focus:text-white"
                    >
                      Full
                    </SelectItem>
                    <SelectItem 
                      value="Shared"
                      className="text-[#2C3E50] focus:bg-[#248bcc] focus:text-white"
                    >
                      Shared
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            )}

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
              {/* Has Lights - only for fields */}
              {formData.locationType !== 'meeting_room' ? (
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
              ) : <div />}
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
                {editingField ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
