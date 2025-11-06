import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Plus, PencilSimple, Trash, Trophy, Barbell, Chalkboard, Calendar, FileXls } from '@phosphor-icons/react';
import { useSchedule, useTeams, useFields, useSites } from '@/hooks/use-data';
import { ScheduleEvent, EventType, EventStatus } from '@/lib/types';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { getTeamById, getFieldById, getSiteById } from '@/lib/data-helpers';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const EVENT_ICONS = {
  practice: Barbell,
  game: Trophy,
  meeting: Chalkboard,
  other: Calendar
};

export function ScheduleTable() {
  const [schedule, setSchedule] = useSchedule();
  const [teams] = useTeams();
  const [fields] = useFields();
  const [sites] = useSites();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [formData, setFormData] = useState({
    fieldId: '',
    siteId: '',
    teamIds: [] as string[],
    startTime: '',
    endTime: '',
    eventType: 'practice' as EventType,
    status: 'planned' as EventStatus,
    estimatedAttendance: '',
    opponent: '',
    notes: '',
    isRecurring: false,
    recurringDays: [] as number[],
    recurringStartDate: '',
    recurringEndDate: ''
  });

  const handleOpenDialog = (event?: ScheduleEvent) => {
    if (event) {
      setEditingEvent(event);
      const field = getFieldById(fields || [], event.fieldId);
      setFormData({
        fieldId: event.fieldId,
        siteId: field?.siteId || '',
        teamIds: event.teamIds,
        startTime: event.startTime.slice(0, 16),
        endTime: event.endTime.slice(0, 16),
        eventType: event.eventType,
        status: event.status,
        estimatedAttendance: event.estimatedAttendance?.toString() || '',
        opponent: event.opponent || '',
        notes: event.notes || '',
        isRecurring: event.isRecurring,
        recurringDays: event.recurringDays || [],
        recurringStartDate: event.recurringStartDate?.slice(0, 10) || '',
        recurringEndDate: event.recurringEndDate?.slice(0, 10) || ''
      });
    } else {
      setEditingEvent(null);
      setFormData({
        fieldId: '',
        siteId: '',
        teamIds: [],
        startTime: '',
        endTime: '',
        eventType: 'practice',
        status: 'planned',
        estimatedAttendance: '',
        opponent: '',
        notes: '',
        isRecurring: false,
        recurringDays: [],
        recurringStartDate: '',
        recurringEndDate: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleStartTimeChange = (value: string) => {
    setFormData(prev => {
      const newFormData = { ...prev, startTime: value };
      if (value && !prev.endTime) {
        const startDate = new Date(value);
        startDate.setMinutes(startDate.getMinutes() + 90);
        newFormData.endTime = startDate.toISOString().slice(0, 16);
      }
      return newFormData;
    });
  };

  const validateTimeRange = (): boolean => {
    if (!formData.startTime || !formData.endTime) return true;
    
    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);
    const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    
    if (diffMinutes < 30) {
      toast.error('End time must be at least 30 minutes after start time');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateTimeRange()) {
      return;
    }

    const requiresField = formData.eventType === 'practice' || formData.eventType === 'game';
    const requiresSite = formData.eventType === 'meeting' || formData.eventType === 'other';

    if (requiresField && !formData.fieldId) {
      toast.error('Field selection is required for practice and game events');
      return;
    }

    if (requiresSite && !formData.siteId) {
      toast.error('Site selection is required for meeting and other events');
      return;
    }

    if (formData.eventType === 'game' && formData.teamIds.length > 1) {
      toast.error('Game events can only have a single team selected');
      return;
    }
    
    if (editingEvent) {
      setSchedule((current) =>
        (current || []).map(ev =>
          ev.id === editingEvent.id
            ? {
                ...ev,
                fieldId: formData.fieldId,
                siteId: requiresSite ? formData.siteId : undefined,
                teamIds: formData.teamIds,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: new Date(formData.endTime).toISOString(),
                eventType: formData.eventType,
                status: formData.status,
                estimatedAttendance: formData.estimatedAttendance ? parseInt(formData.estimatedAttendance) : undefined,
                opponent: formData.opponent || undefined,
                notes: formData.notes || undefined,
                isRecurring: formData.isRecurring,
                recurringDays: formData.isRecurring ? formData.recurringDays : undefined,
                recurringStartDate: formData.isRecurring && formData.recurringStartDate ? new Date(formData.recurringStartDate).toISOString() : undefined,
                recurringEndDate: formData.isRecurring && formData.recurringEndDate ? new Date(formData.recurringEndDate).toISOString() : undefined
              }
            : ev
        )
      );
      toast.success('Event updated successfully');
    } else {
      const newEvent: ScheduleEvent = {
        id: `event-${Date.now()}`,
        fieldId: formData.fieldId,
        siteId: requiresSite ? formData.siteId : undefined,
        teamIds: formData.teamIds,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        eventType: formData.eventType,
        status: formData.status,
        estimatedAttendance: formData.estimatedAttendance ? parseInt(formData.estimatedAttendance) : undefined,
        opponent: formData.opponent || undefined,
        notes: formData.notes || undefined,
        isRecurring: formData.isRecurring,
        recurringDays: formData.isRecurring ? formData.recurringDays : undefined,
        recurringStartDate: formData.isRecurring && formData.recurringStartDate ? new Date(formData.recurringStartDate).toISOString() : undefined,
        recurringEndDate: formData.isRecurring && formData.recurringEndDate ? new Date(formData.recurringEndDate).toISOString() : undefined
      };
      setSchedule((current) => [...(current || []), newEvent]);
      toast.success('Event created successfully');
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      setSchedule((current) => (current || []).filter(ev => ev.id !== id));
      toast.success('Event deleted successfully');
    }
  };

  const toggleTeam = (teamId: string) => {
    setFormData(prev => {
      const newTeamIds = prev.teamIds.includes(teamId)
        ? prev.teamIds.filter(id => id !== teamId)
        : [...prev.teamIds, teamId];
      
      if (prev.eventType === 'game' && newTeamIds.length > 1) {
        toast.error('Game events can only have a single team selected');
        return prev;
      }
      
      return {
        ...prev,
        teamIds: newTeamIds
      };
    });
  };

  const toggleRecurringDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter(d => d !== day)
        : [...prev.recurringDays, day]
    }));
  };

  const handleExportToExcel = () => {
    if (!schedule || schedule.length === 0) {
      toast.error('No schedule data to export');
      return;
    }

    const exportData = schedule.map(event => {
      const eventTeams = (event.teamIds || []).map(id => getTeamById(teams || [], id)).filter(Boolean);
      const field = event.fieldId ? getFieldById(fields || [], event.fieldId) : undefined;
      const site = field 
        ? getSiteById(sites || [], field.siteId) 
        : event.siteId 
          ? getSiteById(sites || [], event.siteId)
          : undefined;

      return {
        'Event ID': event.id,
        'Event Type': event.eventType,
        'Status': event.status,
        'Team(s)': eventTeams.map(t => t?.name).join(' & ') || 'Unknown',
        'Opponent': event.opponent || '',
        'Start Date': format(new Date(event.startTime), 'MMM d, yyyy'),
        'Start Time': format(new Date(event.startTime), 'h:mm a'),
        'End Time': format(new Date(event.endTime), 'h:mm a'),
        'Duration (minutes)': Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60)),
        'Site Name': site?.name || 'Unknown',
        'Site Address': site ? `${site.address}, ${site.city}, ${site.state} ${site.zipCode}` : '',
        'Field Name': field?.name || '',
        'Turf Type': field?.turfType || '',
        'Full Field': field?.isFullField ? 'Yes' : field ? 'No' : '',
        'Has Lights': field?.hasLights ? 'Yes' : field ? 'No' : '',
        'Site Has Toilets': site?.hasToilets ? 'Yes' : 'No',
        'Site Has Locker Rooms': site?.hasLockerRooms ? 'Yes' : 'No',
        'Site Has Equipment Storage': site?.hasEquipmentStash ? 'Yes' : 'No',
        'Site Has Restaurant': site?.hasRestaurant ? 'Yes' : 'No',
        'Site Has Parking': site?.hasParking ? 'Yes' : 'No',
        'Estimated Attendance': event.estimatedAttendance || '',
        'Is Recurring': event.isRecurring ? 'Yes' : 'No',
        'Recurring Days': event.recurringDays ? event.recurringDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') : '',
        'Recurring Start Date': event.recurringStartDate ? format(new Date(event.recurringStartDate), 'MMM d, yyyy') : '',
        'Recurring End Date': event.recurringEndDate ? format(new Date(event.recurringEndDate), 'MMM d, yyyy') : '',
        'Notes': event.notes || '',
        'Head Coach Name': eventTeams[0]?.headCoachName || '',
        'Head Coach Email': eventTeams[0]?.headCoachEmail || '',
        'Head Coach Phone': eventTeams[0]?.headCoachPhone || '',
        'Team Manager Name': eventTeams[0]?.teamManagerName || '',
        'Team Manager Email': eventTeams[0]?.teamManagerEmail || '',
        'Team Manager Phone': eventTeams[0]?.teamManagerPhone || '',
        'Site Contact Phone': site?.contactPhone || '',
        'Site Contact Email': site?.contactEmail || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    const columnWidths = [
      { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 25 },
      { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 20 },
      { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 25 }
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');

    const fileName = `QMT_Schedule_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success('Schedule exported successfully');
  };

  const selectedField = fields?.find(f => f.id === formData.fieldId);
  const selectedSite = selectedField 
    ? sites?.find(s => s.id === selectedField.siteId) 
    : sites?.find(s => s.id === formData.siteId);
  
  const requiresField = formData.eventType === 'practice' || formData.eventType === 'game';
  const requiresSite = formData.eventType === 'meeting' || formData.eventType === 'other';

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>Manage scheduled events</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExportToExcel} variant="outline" className="gap-2">
                <FileXls size={18} weight="duotone" />
                Export to Excel
              </Button>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus size={18} weight="duotone" />
                Add Event
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {schedule && schedule.length > 0 ? (
              schedule
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .map(event => {
                  const eventTeams = (event.teamIds || []).map(id => getTeamById(teams || [], id)).filter(Boolean);
                  const field = event.fieldId ? getFieldById(fields || [], event.fieldId) : undefined;
                  const site = field 
                    ? getSiteById(sites || [], field.siteId) 
                    : event.siteId 
                      ? getSiteById(sites || [], event.siteId)
                      : undefined;
                  const EventIcon = EVENT_ICONS[event.eventType];
                  
                  return (
                    <Card key={event.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className={`p-2 rounded-lg ${
                                event.eventType === 'game' ? 'bg-primary/10' :
                                event.eventType === 'practice' ? 'bg-secondary/10' :
                                event.eventType === 'meeting' ? 'bg-accent/10' :
                                'bg-muted'
                              }`}>
                                <EventIcon size={20} weight="duotone" className={
                                  event.eventType === 'game' ? 'text-primary' :
                                  event.eventType === 'practice' ? 'text-secondary' :
                                  event.eventType === 'meeting' ? 'text-accent' :
                                  'text-muted-foreground'
                                } />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold">
                                  {eventTeams.map(t => t?.name).join(' & ') || 'Unknown Team'}
                                </h3>
                                {event.opponent && (
                                  <p className="text-sm text-muted-foreground">vs {event.opponent}</p>
                                )}
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <Badge 
                                  className={`text-xs uppercase font-semibold text-white ${
                                    event.eventType === 'game' ? 'bg-emerald-600' :
                                    event.eventType === 'practice' ? 'bg-blue-600' :
                                    event.eventType === 'meeting' ? 'bg-purple-600' :
                                    'bg-amber-600'
                                  }`}
                                >
                                  {event.eventType}
                                </Badge>
                                <Badge 
                                  className={`text-xs font-semibold text-white ${
                                    event.status === 'confirmed' ? 'bg-green-600' : 
                                    event.status === 'cancelled' ? 'bg-red-600' : 
                                    'bg-slate-500'
                                  }`}
                                >
                                  {event.status}
                                </Badge>
                                {event.isRecurring && (
                                  <Badge className="text-xs font-semibold bg-indigo-600 text-white">
                                    Recurring
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div>
                                <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Date & Time</div>
                                <div className="font-medium">{format(new Date(event.startTime), 'MMM d, yyyy')}</div>
                                <div className="text-muted-foreground">
                                  {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
                                </div>
                              </div>
                              
                              <div>
                                <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Location</div>
                                <div>{site?.name || 'Unknown Site'}</div>
                                {field ? (
                                  <div className="text-muted-foreground">{field.name}</div>
                                ) : (
                                  <div className="text-muted-foreground">{site?.address}, {site?.city}</div>
                                )}
                              </div>
                              
                              {event.estimatedAttendance && (
                                <div>
                                  <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Est. Attendance</div>
                                  <div>{event.estimatedAttendance}</div>
                                </div>
                              )}
                            </div>
                            
                            {event.notes && (
                              <div className="text-sm bg-muted/50 p-2 rounded">{event.notes}</div>
                            )}
                          </div>
                          
                          <div className="flex gap-2 lg:flex-col">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDialog(event)}
                              className="gap-1"
                            >
                              <PencilSimple size={16} weight="duotone" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(event.id)}
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
                No events found. Click "Add Event" to create one.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Update event information' : 'Create a new scheduled event'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="eventType" className="text-right block">Event Type *</Label>
              <Select 
                value={formData.eventType} 
                onValueChange={(value: EventType) => {
                  setFormData(prev => {
                    const newData = { ...prev, eventType: value };
                    if (value === 'game' && prev.teamIds.length > 1) {
                      newData.teamIds = [prev.teamIds[0]];
                      toast.info('Only one team can be selected for game events. Other teams have been removed.');
                    }
                    if (value === 'meeting' || value === 'other') {
                      newData.fieldId = '';
                    } else {
                      newData.siteId = '';
                    }
                    return newData;
                  });
                }}
              >
                <SelectTrigger id="eventType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="game">Game</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {requiresField ? 'Practice and Game events require a field selection' : 'Meeting and Other events require a site selection'}
              </p>
            </div>

            {requiresField && (
              <div className="space-y-2">
                <Label htmlFor="fieldId" className="text-right block">Field *</Label>
                <Select value={formData.fieldId} onValueChange={(value) => {
                  const field = fields?.find(f => f.id === value);
                  setFormData(prev => ({ ...prev, fieldId: value, siteId: field?.siteId || '' }));
                }} required={requiresField}>
                  <SelectTrigger id="fieldId">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields?.filter(field => {
                      const site = getSiteById(sites || [], field.siteId);
                      return site?.isActive !== false;
                    }).map(field => {
                      const site = getSiteById(sites || [], field.siteId);
                      return (
                        <SelectItem key={field.id} value={field.id}>
                          {site?.name} - {field.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedSite && selectedField && (
                  <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                    <strong>Site:</strong> {selectedSite.name} | 
                    <strong> Turf:</strong> {selectedField?.turfType} | 
                    {selectedField?.hasLights && ' Lights ✓ |'}
                    {selectedSite.hasToilets && ' Toilets ✓ |'}
                    {selectedSite.hasLockerRooms && ' Locker Rooms ✓ |'}
                    {selectedSite.hasEquipmentStash && ' Equipment ✓ |'}
                    {selectedSite.hasRestaurant && ' Restaurant ✓'}
                    {selectedSite.hasParking && ' Parking ✓'}
                  </div>
                )}
              </div>
            )}

            {requiresSite && (
              <div className="space-y-2">
                <Label htmlFor="siteId" className="text-right block">Site *</Label>
                <Select value={formData.siteId} onValueChange={(value) => setFormData(prev => ({ ...prev, siteId: value, fieldId: '' }))} required={requiresSite}>
                  <SelectTrigger id="siteId">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites?.filter(site => site.isActive).map(site => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSite && !selectedField && (
                  <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                    <strong>Site:</strong> {selectedSite.name} | 
                    <strong> Address:</strong> {selectedSite.address}, {selectedSite.city}
                    {selectedSite.hasToilets && ' | Toilets ✓'}
                    {selectedSite.hasLockerRooms && ' | Locker Rooms ✓'}
                    {selectedSite.hasEquipmentStash && ' | Equipment ✓'}
                    {selectedSite.hasRestaurant && ' | Restaurant ✓'}
                    {selectedSite.hasParking && ' | Parking ✓'}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-right block">
                Teams * {formData.eventType === 'game' ? '(Select one team only)' : '(Select one or multiple)'}
              </Label>
              {formData.eventType === 'game' && (
                <p className="text-xs text-muted-foreground mb-2">
                  Game events can only have a single team selected.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg max-h-40 overflow-y-auto">
                {teams && teams.length > 0 ? (
                  teams.filter(t => t.isActive).map(team => (
                    <div key={team.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`team-${team.id}`}
                        checked={formData.teamIds.includes(team.id)}
                        onCheckedChange={() => toggleTeam(team.id)}
                      />
                      <Label htmlFor={`team-${team.id}`} className="font-normal cursor-pointer">
                        {team.name}
                      </Label>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground col-span-2">No active teams available</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime" className="text-right block">Start Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime" className="text-right block">End Time *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status" className="text-right block">Status *</Label>
                <Select value={formData.status} onValueChange={(value: EventStatus) => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedAttendance" className="text-right block">Est. Attendance</Label>
                <Input
                  id="estimatedAttendance"
                  type="number"
                  value={formData.estimatedAttendance}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedAttendance: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            {formData.eventType === 'game' && (
              <div className="space-y-2">
                <Label htmlFor="opponent" className="text-right block">Opponent</Label>
                <Input
                  id="opponent"
                  value={formData.opponent}
                  onChange={(e) => setFormData(prev => ({ ...prev, opponent: e.target.value }))}
                  placeholder="Opposing team name"
                />
              </div>
            )}

            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Switch
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: checked }))}
                />
                <Label htmlFor="isRecurring">Recurring Event</Label>
              </div>

              {formData.isRecurring && (
                <div className="space-y-4 pl-2">
                  <div className="space-y-2">
                    <Label className="text-right block">Select Days</Label>
                    <div className="flex gap-2 flex-wrap">
                      {weekDays.map((day, index) => (
                        <Button
                          key={index}
                          type="button"
                          variant={formData.recurringDays.includes(index) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleRecurringDay(index)}
                          className="w-12"
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="recurringStartDate" className="text-right block">Start Date</Label>
                      <Input
                        id="recurringStartDate"
                        type="date"
                        value={formData.recurringStartDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, recurringStartDate: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recurringEndDate" className="text-right block">End Date</Label>
                      <Input
                        id="recurringEndDate"
                        type="date"
                        value={formData.recurringEndDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, recurringEndDate: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-right block">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional information..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={
                  formData.teamIds.length === 0 || 
                  (requiresField && !formData.fieldId) || 
                  (requiresSite && !formData.siteId)
                }
              >
                {editingEvent ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
