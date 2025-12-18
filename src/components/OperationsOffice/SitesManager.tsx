import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { Site, Amenity, User } from '@/lib/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, PencilSimple, MapPin, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { COLORS } from '@/lib/constants'

interface SitesManagerProps {
  currentUser: User | null
}

export default function SitesManager({ currentUser }: SitesManagerProps) {
  const { sites, setSites, fields, setFields } = useData()
  const [showDialog, setShowDialog] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)

  const [formData, setFormData] = useState<Partial<Site>>({
    name: '',
    address: '',
    zipCode: '',
    city: '',
    latitude: 0,
    longitude: 0,
    contactFirstName: '',
    contactLastName: '',
    contactPhone: '',
    contactEmail: '',
    isSportsFacility: true,
    amenities: {
      parking: false,
      toilets: false,
      lockerRooms: false,
      shower: false,
      restaurant: false,
      equipmentStash: false
    },
    isActive: true
  })

  const handleCreate = () => {
    setEditingSite(null)
    setFormData({
      name: '',
      address: '',
      zipCode: '',
      city: '',
      latitude: 0,
      longitude: 0,
      contactFirstName: '',
      contactLastName: '',
      contactPhone: '',
      contactEmail: '',
      isSportsFacility: true,
      amenities: {
        parking: false,
        toilets: false,
        lockerRooms: false,
        shower: false,
        restaurant: false,
        equipmentStash: false
      },
      isActive: true
    })
    setShowDialog(true)
  }

  const handleEdit = (site: Site) => {
    setEditingSite(site)
    setFormData(site)
    setShowDialog(true)
  }

  const handleDelete = async (siteId: string) => {
    if (confirm('Are you sure you want to delete this site?')) {
      try {
        const numericId = parseInt(siteId)
        if (!isNaN(numericId)) {
          await api.deleteSite(numericId)
        }
        setSites((current) => (current || []).filter(s => s.id !== siteId))
        setFields((current: any) => (current || []).filter((f: any) => f.siteId !== siteId))
        toast.success('Site deleted successfully')
      } catch (error: any) {
        console.error('Error deleting site:', error)
        toast.error(error.message || 'Failed to delete site')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (!formData.name) {
        toast.error('Site name is required')
        return
      }

      const apiData = {
        name: formData.name,
        address: formData.address || null,
        amenities: JSON.stringify(formData.amenities)
      }

      if (editingSite) {
        const numericId = parseInt(editingSite.id)
        if (!isNaN(numericId)) {
          await api.updateSite(numericId, apiData)
        }
        setSites((current) =>
          (current || []).map(s => s.id === editingSite.id ? { ...formData, id: editingSite.id } as Site : s)
        )
        
        if (!formData.isActive) {
          setFields((current: any) =>
            (current || []).map((f: any) => 
              f.siteId === editingSite.id ? { ...f, isActive: false } : f
            )
          )
        }
        
        toast.success('Site updated successfully')
      } else {
        const response = await api.createSite(apiData)
        const newSite: Site = {
          ...formData,
          id: response.id?.toString() || `site-${Date.now()}`
        } as Site
        
        setSites((current) => [...(current || []), newSite])
        toast.success('Site created successfully')
      }
      
      setShowDialog(false)
    } catch (error: any) {
      console.error('Error saving site:', error)
      toast.error(error.message || 'Failed to save site')
    }
  }

  const handleAmenityChange = (amenity: keyof Amenity) => {
    setFormData((prev) => ({
      ...prev,
      amenities: {
        ...prev.amenities!,
        [amenity]: !prev.amenities![amenity]
      }
    }))
  }

  const handleToggleActive = async (siteId: string, currentActive: boolean) => {
    try {
      const site = (sites || []).find(s => s.id === siteId)
      if (!site) return

      const numericId = parseInt(siteId)
      if (!isNaN(numericId)) {
        const apiData = {
          name: site.name,
          address: site.address || null
        }
        await api.updateSite(numericId, apiData)
      }
      
      setSites((current) =>
        (current || []).map(s => s.id === siteId ? { ...s, isActive: !currentActive } : s)
      )
      toast.success(`Site ${currentActive ? 'deactivated' : 'activated'} successfully`)
    } catch (error: any) {
      console.error('Error toggling site status:', error)
      toast.error(error.message || 'Failed to update site status')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sites Management</h2>
        <Button onClick={handleCreate}>
          <Plus className="mr-2" size={16} />
          Add Site
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => (
          <Card key={site.id} className={!site.isActive ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2" style={{ color: COLORS.NAVY }}>
                    <MapPin size={16} />
                    {site.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    {site.isSportsFacility && (
                      <Badge variant="secondary" className="text-xs">Sports Facility</Badge>
                    )}
                    <Badge variant={site.isActive ? 'default' : 'destructive'} className="text-xs">
                      {site.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                {currentUser && (currentUser.role === 'admin' || currentUser.role === 'mgmt') && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#248bcc] hover:text-[#248bcc] hover:bg-[#248bcc]/10"
                      onClick={() => handleEdit(site)}
                      title="Edit site"
                    >
                      <PencilSimple size={18} weight="bold" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(site.id)}
                      title="Delete site"
                    >
                      <Trash size={18} weight="bold" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div style={{ color: COLORS.CHARCOAL }}>
                <div className="font-medium">{site.address}</div>
                <div className="text-muted-foreground">{site.zipCode} {site.city}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Contact: {site.contactFirstName} {site.contactLastName}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {site.amenities.parking && <Badge variant="outline" className="text-xs">Parking</Badge>}
                {site.amenities.toilets && <Badge variant="outline" className="text-xs">Toilets</Badge>}
                {site.amenities.lockerRooms && <Badge variant="outline" className="text-xs">Lockers</Badge>}
                {site.amenities.shower && <Badge variant="outline" className="text-xs">Shower</Badge>}
                {site.amenities.restaurant && <Badge variant="outline" className="text-xs">Restaurant</Badge>}
                {site.amenities.equipmentStash && <Badge variant="outline" className="text-xs">Equipment</Badge>}
              </div>
              {currentUser && (currentUser.role === 'admin' || currentUser.role === 'mgmt') && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs font-medium" style={{ color: COLORS.CHARCOAL }}>Status</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: COLORS.CHARCOAL }}>
                      {site.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Switch
                      checked={site.isActive}
                      onCheckedChange={() => handleToggleActive(site.id, site.isActive)}
                      style={{
                        backgroundColor: site.isActive ? COLORS.NAVY : undefined
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
          className="max-w-2xl max-h-[90vh] overflow-y-auto operations-dialog"
          style={{
            background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)',
            border: `3px solid ${COLORS.NAVY}`,
            boxShadow: '0 20px 60px rgba(0, 31, 63, 0.3)'
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: COLORS.NAVY }}>
              {editingSite ? 'Edit Site' : 'Create Site'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: COLORS.CHARCOAL }}>Site Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address" style={{ color: COLORS.CHARCOAL }}>Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" style={{ color: COLORS.CHARCOAL }}>City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zipCode" style={{ color: COLORS.CHARCOAL }}>Zip Code *</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="latitude" style={{ color: COLORS.CHARCOAL }}>Latitude *</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude" style={{ color: COLORS.CHARCOAL }}>Longitude *</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactFirstName" style={{ color: COLORS.CHARCOAL }}>Contact First Name *</Label>
                <Input
                  id="contactFirstName"
                  value={formData.contactFirstName}
                  onChange={(e) => setFormData({ ...formData, contactFirstName: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactLastName" style={{ color: COLORS.CHARCOAL }}>Contact Last Name *</Label>
                <Input
                  id="contactLastName"
                  value={formData.contactLastName}
                  onChange={(e) => setFormData({ ...formData, contactLastName: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPhone" style={{ color: COLORS.CHARCOAL }}>Contact Phone *</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail" style={{ color: COLORS.CHARCOAL }}>Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label style={{ color: COLORS.CHARCOAL }}>Amenities</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="parking"
                    checked={formData.amenities?.parking}
                    onCheckedChange={() => handleAmenityChange('parking')}
                  />
                  <label htmlFor="parking" className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>Parking</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="toilets"
                    checked={formData.amenities?.toilets}
                    onCheckedChange={() => handleAmenityChange('toilets')}
                  />
                  <label htmlFor="toilets" className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>Toilets</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lockerRooms"
                    checked={formData.amenities?.lockerRooms}
                    onCheckedChange={() => handleAmenityChange('lockerRooms')}
                  />
                  <label htmlFor="lockerRooms" className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>Locker Rooms</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="shower"
                    checked={formData.amenities?.shower}
                    onCheckedChange={() => handleAmenityChange('shower')}
                  />
                  <label htmlFor="shower" className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>Shower</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="restaurant"
                    checked={formData.amenities?.restaurant}
                    onCheckedChange={() => handleAmenityChange('restaurant')}
                  />
                  <label htmlFor="restaurant" className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>Restaurant</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="equipmentStash"
                    checked={formData.amenities?.equipmentStash}
                    onCheckedChange={() => handleAmenityChange('equipmentStash')}
                  />
                  <label htmlFor="equipmentStash" className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>Equipment Stash</label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isSportsFacility"
                  checked={formData.isSportsFacility}
                  onCheckedChange={(checked) => setFormData({ ...formData, isSportsFacility: checked })}
                  style={{
                    backgroundColor: formData.isSportsFacility ? COLORS.NAVY : undefined
                  }}
                />
                <Label htmlFor="isSportsFacility" style={{ color: COLORS.CHARCOAL }}>Sports Facility</Label>
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
                {editingSite ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
