import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, PencilSimple, Trash, Check, X, MapPin, Car, Phone, Envelope } from '@phosphor-icons/react';
import { useSites, useFields } from '@/hooks/use-data';
import { Site } from '@/lib/types';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export function SitesTable() {
  const [sites, setSites] = useSites();
  const [fields] = useFields();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    latitude: '',
    longitude: '',
    isActive: true,
    hasToilets: false,
    hasLockerRooms: false,
    hasEquipmentStash: false,
    hasRestaurant: false,
    hasParking: false,
    contactPhone: '',
    contactEmail: ''
  });

  const handleOpenDialog = (site?: Site) => {
    if (site) {
      setEditingSite(site);
      setFormData({
        name: site.name,
        address: site.address,
        city: site.city,
        state: site.state,
        zipCode: site.zipCode,
        latitude: site.latitude || '',
        longitude: site.longitude || '',
        isActive: site.isActive,
        hasToilets: site.hasToilets,
        hasLockerRooms: site.hasLockerRooms,
        hasEquipmentStash: site.hasEquipmentStash,
        hasRestaurant: site.hasRestaurant,
        hasParking: site.hasParking,
        contactPhone: site.contactPhone || '',
        contactEmail: site.contactEmail || ''
      });
    } else {
      setEditingSite(null);
      setFormData({
        name: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        latitude: '',
        longitude: '',
        isActive: true,
        hasToilets: false,
        hasLockerRooms: false,
        hasEquipmentStash: false,
        hasRestaurant: false,
        hasParking: false,
        contactPhone: '',
        contactEmail: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingSite) {
      setSites((current) =>
        (current || []).map(s =>
          s.id === editingSite.id
            ? { ...s, ...formData }
            : s
        )
      );
      toast.success('Site updated successfully');
    } else {
      const newSite: Site = {
        id: `site-${Date.now()}`,
        name: formData.name,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        latitude: formData.latitude || undefined,
        longitude: formData.longitude || undefined,
        isActive: formData.isActive,
        hasToilets: formData.hasToilets,
        hasLockerRooms: formData.hasLockerRooms,
        hasEquipmentStash: formData.hasEquipmentStash,
        hasRestaurant: formData.hasRestaurant,
        hasParking: formData.hasParking,
        contactPhone: formData.contactPhone || undefined,
        contactEmail: formData.contactEmail || undefined
      };
      setSites((current) => [...(current || []), newSite]);
      toast.success('Site created successfully');
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    const hasFields = fields?.some(f => f.siteId === id);
    if (hasFields) {
      toast.error('Cannot delete site with associated fields');
      return;
    }
    
    if (confirm('Are you sure you want to delete this site?')) {
      setSites((current) => (current || []).filter(s => s.id !== id));
      toast.success('Site deleted successfully');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sites</CardTitle>
              <CardDescription>Manage facility locations</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus size={18} weight="duotone" />
              Add Site
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sites && sites.length > 0 ? (
              sites.map(site => {
                const mapsUrl = site.latitude && site.longitude
                  ? `https://maps.google.ch/?q=${site.latitude},${site.longitude}`
                  : `https://maps.google.ch/?q=${encodeURIComponent(`${site.address}, ${site.city}, ${site.state} ${site.zipCode}`)}`;
                
                return (
                  <Card key={site.id} className={`overflow-hidden ${!site.isActive ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold">{site.name}</h3>
                            <Badge variant={site.isActive ? 'default' : 'secondary'}>
                              {site.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Address</div>
                              <div>{site.address}</div>
                              <div className="text-muted-foreground">{site.city}, {site.state} {site.zipCode}</div>
                              {(site.latitude && site.longitude) && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Coordinates: {site.latitude}, {site.longitude}
                                </div>
                              )}
                              <Button
                                variant="link"
                                size="sm"
                                className="gap-1 px-0 h-auto mt-2"
                                asChild
                              >
                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                                  <MapPin size={14} weight="duotone" />
                                  View on Google Maps
                                </a>
                              </Button>
                            </div>
                            
                            <div>
                              <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Amenities</div>
                              <div className="flex flex-wrap gap-2">
                                {site.hasToilets && (
                                  <div className="flex items-center gap-1 text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                                    <Check size={12} weight="duotone" />
                                    Toilets
                                  </div>
                                )}
                                {site.hasLockerRooms && (
                                  <div className="flex items-center gap-1 text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                                    <Check size={12} weight="duotone" />
                                    Locker Rooms
                                  </div>
                                )}
                                {site.hasEquipmentStash && (
                                  <div className="flex items-center gap-1 text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                                    <Check size={12} weight="duotone" />
                                    Equipment Stash
                                  </div>
                                )}
                                {site.hasRestaurant && (
                                  <div className="flex items-center gap-1 text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                                    <Check size={12} weight="duotone" />
                                    Restaurant
                                  </div>
                                )}
                                {site.hasParking && (
                                  <div className="flex items-center gap-1 text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                                    <Check size={12} weight="duotone" />
                                    Parking
                                  </div>
                                )}
                                {!site.hasToilets && !site.hasLockerRooms && !site.hasEquipmentStash && !site.hasRestaurant && !site.hasParking && (
                                  <div className="text-muted-foreground text-xs">No amenities</div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {(site.contactPhone || site.contactEmail) && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-2">Contact Information</div>
                              <div className="flex flex-col gap-2 text-sm">
                                {site.contactPhone && (
                                  <div className="flex items-center gap-2">
                                    <Phone size={14} weight="duotone" className="text-primary" />
                                    <a href={`tel:${site.contactPhone}`} className="hover:underline text-foreground">
                                      {site.contactPhone}
                                    </a>
                                  </div>
                                )}
                                {site.contactEmail && (
                                  <div className="flex items-center gap-2">
                                    <Envelope size={14} weight="duotone" className="text-primary" />
                                    <a href={`mailto:${site.contactEmail}`} className="hover:underline text-foreground">
                                      {site.contactEmail}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2 lg:flex-col">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(site)}
                            className="gap-1"
                          >
                            <PencilSimple size={16} weight="duotone" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(site.id)}
                            className="gap-1"
                          >
                            <Trash size={16} weight="duotone" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No sites found. Click "Add Site" to create one.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSite ? 'Edit Site' : 'Add New Site'}</DialogTitle>
            <DialogDescription>
              {editingSite ? 'Update site information' : 'Create a new site'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Site Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-1">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  required
                  maxLength={2}
                  placeholder="CA"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip Code *</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                  required
                  maxLength={10}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  value={formData.latitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                  placeholder="47.3769"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  value={formData.longitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                  placeholder="8.5417"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                  placeholder="+41 XX XXX XX XX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                  placeholder="contact@site.com"
                />
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive" className="font-semibold">Active Site</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Inactive sites and their fields will not be available for selection when creating events.
              </p>
            </div>

            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold text-sm uppercase tracking-wide">Amenities</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="hasToilets"
                    checked={formData.hasToilets}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasToilets: checked }))}
                  />
                  <Label htmlFor="hasToilets">Toilets</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="hasLockerRooms"
                    checked={formData.hasLockerRooms}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasLockerRooms: checked }))}
                  />
                  <Label htmlFor="hasLockerRooms">Locker Rooms</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="hasEquipmentStash"
                    checked={formData.hasEquipmentStash}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasEquipmentStash: checked }))}
                  />
                  <Label htmlFor="hasEquipmentStash">Equipment Stash</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="hasRestaurant"
                    checked={formData.hasRestaurant}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasRestaurant: checked }))}
                  />
                  <Label htmlFor="hasRestaurant">Restaurant</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="hasParking"
                    checked={formData.hasParking}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasParking: checked }))}
                  />
                  <Label htmlFor="hasParking">Parking</Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSite ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
