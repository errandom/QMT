import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Site, Amenity, User } from '@/lib/types'
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

interface SitesManagerProps {
  currentUser: User | null
}

export default function SitesManager({ currentUser }: SitesManagerProps) {
  const [sites = [], setSites] = useKV<Site[]>('sites', [])
  const [fields = [], setFields] = useKV<any[]>('fields', [])
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

  const handleDelete = (siteId: string) => {
    if (confirm('Are you sure you want to delete this site?')) {
      setSites((current) => (current || []).filter(s => s.id !== siteId))
      setFields((current: any) => (current || []).filter((f: any) => f.siteId !== siteId))
      toast.success('Site deleted successfully')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingSite) {
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
      const newSite: Site = {
        ...formData,
        id: `site-${Date.now()}`
      } as Site
      
      setSites((current) => [...(current || []), newSite])
      toast.success('Site created successfully')
    }
    
    setShowDialog(false)
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
                  <CardTitle className="text-base flex items-center gap-2">
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
              <div>
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
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSite ? 'Edit Site' : 'Create Site'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Site Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip Code *</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude *</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude *</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactFirstName">Contact First Name *</Label>
                <Input
                  id="contactFirstName"
                  value={formData.contactFirstName}
                  onChange={(e) => setFormData({ ...formData, contactFirstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactLastName">Contact Last Name *</Label>
                <Input
                  id="contactLastName"
                  value={formData.contactLastName}
                  onChange={(e) => setFormData({ ...formData, contactLastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone *</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Amenities</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="parking"
                    checked={formData.amenities?.parking}
                    onCheckedChange={() => handleAmenityChange('parking')}
                  />
                  <label htmlFor="parking" className="text-sm cursor-pointer">Parking</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="toilets"
                    checked={formData.amenities?.toilets}
                    onCheckedChange={() => handleAmenityChange('toilets')}
                  />
                  <label htmlFor="toilets" className="text-sm cursor-pointer">Toilets</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lockerRooms"
                    checked={formData.amenities?.lockerRooms}
                    onCheckedChange={() => handleAmenityChange('lockerRooms')}
                  />
                  <label htmlFor="lockerRooms" className="text-sm cursor-pointer">Locker Rooms</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="shower"
                    checked={formData.amenities?.shower}
                    onCheckedChange={() => handleAmenityChange('shower')}
                  />
                  <label htmlFor="shower" className="text-sm cursor-pointer">Shower</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="restaurant"
                    checked={formData.amenities?.restaurant}
                    onCheckedChange={() => handleAmenityChange('restaurant')}
                  />
                  <label htmlFor="restaurant" className="text-sm cursor-pointer">Restaurant</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="equipmentStash"
                    checked={formData.amenities?.equipmentStash}
                    onCheckedChange={() => handleAmenityChange('equipmentStash')}
                  />
                  <label htmlFor="equipmentStash" className="text-sm cursor-pointer">Equipment Stash</label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isSportsFacility"
                  checked={formData.isSportsFacility}
                  onCheckedChange={(checked) => setFormData({ ...formData, isSportsFacility: checked })}
                />
                <Label htmlFor="isSportsFacility">Sports Facility</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSite ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}