import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Event, EventType, EventStatus, Team, Field } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, PencilSimple, CalendarBlank, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' }
]

export default function ScheduleManager() {
  const [events = [], setEvents] = useKV<Event[]>('events', [])
  const [teams = []] = useKV<Team[]>('teams', [])
  const [fields = []] = useKV<Field[]>('fields', [])
  const [sites = []] = useKV<any[]>('sites', [])
  const [showDialog, setShowDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)

  const [formData, setFormData] = useState<Partial<Event>>({
    title: '',
    eventType: 'Practice',
    status: 'Planned',
    date: '',
    startTime: '',
    endTime: '',
    fieldId: '',
    teamIds: [],
    otherParticipants: '',
    estimatedAttendance: undefined,
    notes: '',
    isRecurring: false,
    recurringDays: [],
    recurringEndDate: ''
  })

  const activeTeams = teams.filter(t => t.isActive)
  const activeFields = fields.filter((f: any) => {
    const site = (sites || []).find((s: any) => s.id === f.siteId)
    return f.isActive && site?.isActive
  })

  const handleCreate = () => {
    setEditingEvent(null)
    setFormData({
      title: '',
      eventType: 'Practice',
      status: 'Planned',
      date: '',
      startTime: '',
      endTime: '',
      fieldId: '',
      teamIds: [],
      otherParticipants: '',
      estimatedAttendance: undefined,
      notes: '',
      isRecurring: false,
      recurringDays: [],
      recurringEndDate: ''
    })
    setShowDialog(true)
  }

  const handleEdit = (event: Event) => {
    setEditingEvent(event)
    setFormData(event)
    setShowDialog(true)
  }

  const handleDelete = (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      setEvents((current = []) => current.filter(ev => ev.id !== eventId))
      toast.success('Event deleted successfully')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.status === 'Confirmed' && !formData.fieldId) {
      toast.error('Cannot confirm an event without a field location')
      return
    }
    
    if (editingEvent) {
      setEvents((current = []) =>
        current.map(ev => ev.id === editingEvent.id ? { ...formData, id: editingEvent.id } as Event : ev)
      )
      toast.success('Event updated successfully')
    } else {
      const newEvent: Event = {
        ...formData,
        id: `event-${Date.now()}`
      } as Event
      
      setEvents((current = []) => [...current, newEvent])
      toast.success('Event created successfully')
    }
    
    setShowDialog(false)
  }

  const handleTeamToggle = (teamId: string) => {
    setFormData((prev) => ({
      ...prev,
      teamIds: prev.teamIds?.includes(teamId)
        ? prev.teamIds.filter(id => id !== teamId)
        : [...(prev.teamIds || []), teamId]
    }))
  }

  const handleDayToggle = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      recurringDays: prev.recurringDays?.includes(day)
        ? prev.recurringDays.filter(d => d !== day)
        : [...(prev.recurringDays || []), day]
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Schedule Management</h2>
        <Button onClick={handleCreate}>
          <Plus className="mr-2" size={16} />
          Add Event
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {events.map((event) => (
          <Card key={event.id} className="glass-card">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <CardTitle className="text-base">{event.title}</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">{event.eventType}</Badge>
                    <Badge>{event.status}</Badge>
                    {event.isRecurring && <Badge variant="outline">Recurring</Badge>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-[#248bcc]/10 hover:text-[#248bcc]"
                    onClick={() => handleEdit(event)}
                    title="Edit event"
                  >
                    <PencilSimple size={18} weight="duotone" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(event.id)}
                    title="Delete event"
                  >
                    <Trash size={18} weight="duotone" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <CalendarBlank size={14} />
                {event.date} • {event.startTime} - {event.endTime}
              </div>
              {event.teamIds && event.teamIds.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Teams: {event.teamIds.map(id => teams.find(t => t.id === id)?.name).join(', ')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type *</Label>
                <Select value={formData.eventType} onValueChange={(v) => setFormData({ ...formData, eventType: v as EventType })}>
                  <SelectTrigger id="eventType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Game">Game</SelectItem>
                    <SelectItem value="Practice">Practice</SelectItem>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as EventStatus })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field">Field</Label>
              <Select value={formData.fieldId} onValueChange={(v) => setFormData({ ...formData, fieldId: v })}>
                <SelectTrigger id="field">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {activeFields.map((field: any) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name} ({(sites || []).find((s: any) => s.id === field.siteId)?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Teams</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-32 overflow-y-auto">
                {activeTeams.map(team => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-team-${team.id}`}
                      checked={formData.teamIds?.includes(team.id)}
                      onCheckedChange={() => handleTeamToggle(team.id)}
                    />
                    <label htmlFor={`event-team-${team.id}`} className="text-sm cursor-pointer">
                      {team.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otherParticipants">Other Participants</Label>
              <Input
                id="otherParticipants"
                value={formData.otherParticipants}
                onChange={(e) => setFormData({ ...formData, otherParticipants: e.target.value })}
                placeholder="Specify other participants..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendance">Estimated Attendance</Label>
              <Input
                id="attendance"
                type="number"
                value={formData.estimatedAttendance || ''}
                onChange={(e) => setFormData({ ...formData, estimatedAttendance: e.target.value ? parseInt(e.target.value) : undefined })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
                />
                <Label htmlFor="isRecurring">Recurring Event</Label>
              </div>

              {formData.isRecurring && (
                <div className="space-y-3 pl-6 border-l-2">
                  <div className="space-y-2">
                    <Label>Weekdays</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {WEEKDAYS.map(day => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={formData.recurringDays?.includes(day.value)}
                            onCheckedChange={() => handleDayToggle(day.value)}
                          />
                          <label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurringEndDate">End Date *</Label>
                    <Input
                      id="recurringEndDate"
                      type="date"
                      value={formData.recurringEndDate}
                      onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                      required={formData.isRecurring}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEvent ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}