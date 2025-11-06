import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, PencilSimple, Trash, Check } from '@phosphor-icons/react';
import { useFields, useSites, useSchedule } from '@/hooks/use-data';
import { Field } from '@/lib/types';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { getSiteById } from '@/lib/data-helpers';

export function FieldsTable() {
  const [fields, setFields] = useFields();
  const [sites] = useSites();
  const [schedule] = useSchedule();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    siteId: '',
    turfType: 'natural' as 'artificial' | 'natural' | 'indoor-gym',
    hasLights: false,
    isFullField: true,
    capacity: ''
  });

  const handleOpenDialog = (field?: Field) => {
    if (field) {
      setEditingField(field);
      setFormData({
        name: field.name,
        siteId: field.siteId,
        turfType: field.turfType,
        hasLights: field.hasLights,
        isFullField: field.isFullField,
        capacity: field.capacity?.toString() || ''
      });
    } else {
      setEditingField(null);
      setFormData({
        name: '',
        siteId: '',
        turfType: 'natural',
        hasLights: false,
        isFullField: true,
        capacity: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingField) {
      setFields((current) =>
        (current || []).map(f =>
          f.id === editingField.id
            ? { 
                ...f, 
                name: formData.name,
                siteId: formData.siteId,
                turfType: formData.turfType,
                hasLights: formData.hasLights,
                isFullField: formData.isFullField,
                capacity: formData.capacity ? parseInt(formData.capacity) : undefined
              }
            : f
        )
      );
      toast.success('Field updated successfully');
    } else {
      const newField: Field = {
        id: `field-${Date.now()}`,
        name: formData.name,
        siteId: formData.siteId,
        turfType: formData.turfType,
        hasLights: formData.hasLights,
        isFullField: formData.isFullField,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined
      };
      setFields((current) => [...(current || []), newField]);
      toast.success('Field created successfully');
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    const hasSchedule = schedule?.some(s => s.fieldId === id);
    if (hasSchedule) {
      toast.error('Cannot delete field with scheduled events');
      return;
    }
    
    if (confirm('Are you sure you want to delete this field?')) {
      setFields((current) => (current || []).filter(f => f.id !== id));
      toast.success('Field deleted successfully');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fields</CardTitle>
              <CardDescription>Manage playing fields</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus size={18} weight="duotone" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {fields && fields.length > 0 ? (
              fields.map(field => {
                const site = getSiteById(sites || [], field.siteId);
                return (
                  <Card key={field.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold">{field.name}</h3>
                            <Badge 
                              className={`font-semibold text-white ${
                                field.turfType === 'artificial' ? 'bg-lime-600' : 
                                field.turfType === 'natural' ? 'bg-green-700' : 
                                'bg-cyan-600'
                              }`}
                            >
                              {field.turfType === 'artificial' ? 'Artificial Turf' : field.turfType === 'natural' ? 'Natural Turf' : 'Indoor Gym'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Location</div>
                              <div>{site?.name || 'Unknown Site'}</div>
                              {field.capacity && <div className="text-muted-foreground">Capacity: {field.capacity}</div>}
                            </div>
                            
                            <div>
                              <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Features</div>
                              <div className="flex flex-wrap gap-2">
                                {field.hasLights && (
                                  <div className="flex items-center gap-1 text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                                    <Check size={12} weight="duotone" />
                                    Lights
                                  </div>
                                )}
                                {field.isFullField ? (
                                  <div className="flex items-center gap-1 text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                                    <Check size={12} weight="duotone" />
                                    Full Field
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                                    Shared Field
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 lg:flex-col">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(field)}
                            className="gap-1"
                          >
                            <PencilSimple size={16} weight="duotone" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(field.id)}
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
                No fields found. Click "Add Field" to create one.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add New Field'}</DialogTitle>
            <DialogDescription>
              {editingField ? 'Update field information' : 'Create a new field'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Field Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="siteId">Site *</Label>
                <Select value={formData.siteId} onValueChange={(value) => setFormData(prev => ({ ...prev, siteId: value }))} required>
                  <SelectTrigger id="siteId">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites?.map(site => (
                      <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="turfType">Turf Type *</Label>
              <Select value={formData.turfType} onValueChange={(value: 'artificial' | 'natural' | 'indoor-gym') => setFormData(prev => ({ ...prev, turfType: value }))}>
                <SelectTrigger id="turfType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural Turf</SelectItem>
                  <SelectItem value="artificial">Artificial Turf</SelectItem>
                  <SelectItem value="indoor-gym">Indoor Gym</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold text-sm uppercase tracking-wide">Features</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="hasLights"
                    checked={formData.hasLights}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasLights: checked }))}
                  />
                  <Label htmlFor="hasLights">Lights Available</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="isFullField"
                    checked={formData.isFullField}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFullField: checked }))}
                  />
                  <Label htmlFor="isFullField">Full Field</Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingField ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
