import { useState, useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { Event, EventType, EventStatus, Team, Field, User } from '@/lib/types'
import { api } from '@/lib/api'
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
import { Plus, PencilSimple, CalendarBlank, Trash, FunnelSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { COLORS } from '@/lib/constants'

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' }
]

interface ScheduleManagerProps {
  currentUser: User | null
}

export default function ScheduleManager({ currentUser }: ScheduleManagerProps) {
  const { events, setEvents, teams, fields, sites } = useData()
  const [showDialog, setShowDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)

  // Filter state
  const [filterTeam, setFilterTeam] = useState<string>('all')
  const [filterEventType, setFilterEventType] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')

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

  const handleDelete = async (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      try {
        const numericId = parseInt(eventId)
        if (!isNaN(numericId)) {
          await api.deleteEvent(numericId)
        }
        setEvents((current = []) => current.filter(ev => ev.id !== eventId))
        toast.success('Event deleted successfully')
      } catch (error: any) {
        console.error('Error deleting event:', error)
        toast.error(error.message || 'Failed to delete event')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (formData.status === 'Confirmed' && !formData.fieldId) {
        toast.error('Cannot confirm an event without a field location')
        return
      }

      if (formData.isRecurring && (!formData.recurringDays || formData.recurringDays.length === 0)) {
        toast.error('Please select at least one weekday for the recurring event')
        return
      }

      if (formData.isRecurring && !formData.recurringEndDate) {
        toast.error('Please specify an end date for the recurring event')
        return
      }

      if (editingEvent) {
        // Editing existing event - update single event only
        const apiData = {
          team_id: formData.teamIds && formData.teamIds.length > 0 ? parseInt(formData.teamIds[0]) : null,
          team_ids: formData.teamIds && formData.teamIds.length > 0 ? formData.teamIds.join(',') : null,
          field_id: formData.fieldId ? parseInt(formData.fieldId) : null,
          event_type: formData.eventType,
          start_time: `${formData.date}T${formData.startTime}:00`,
          end_time: `${formData.date}T${formData.endTime}:00`,
          description: formData.title || '',
          notes: formData.notes || '',
          status: formData.status || 'Planned',
          recurring_days: formData.isRecurring && formData.recurringDays ? formData.recurringDays : null,
          recurring_end_date: formData.isRecurring && formData.recurringEndDate ? formData.recurringEndDate : null
        }

        const numericId = parseInt(editingEvent.id)
        if (!isNaN(numericId)) {
          const transformedEvent = await api.updateEvent(numericId, apiData)
          setEvents((current = []) =>
            current.map(ev => ev.id === editingEvent.id ? transformedEvent : ev)
          )
        }
        toast.success('Event updated successfully')
      } else {
        // Creating new event(s)
        if (formData.isRecurring) {
          // Generate all recurring event instances
          const startDate = new Date(formData.date!)
          const endDate = new Date(formData.recurringEndDate!)
          const createdEvents: Event[] = []
          
          // Iterate through each day from start to end date
          for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
            const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay() // Convert Sunday from 0 to 7
            
            // Check if this day is in the selected recurring days
            if (formData.recurringDays?.includes(dayOfWeek)) {
              const dateStr = currentDate.toISOString().split('T')[0]
              
              const apiData = {
                team_id: formData.teamIds && formData.teamIds.length > 0 ? parseInt(formData.teamIds[0]) : null,
                team_ids: formData.teamIds && formData.teamIds.length > 0 ? formData.teamIds.join(',') : null,
                field_id: formData.fieldId ? parseInt(formData.fieldId) : null,
                event_type: formData.eventType,
                start_time: `${dateStr}T${formData.startTime}:00`,
                end_time: `${dateStr}T${formData.endTime}:00`,
                description: formData.title || '',
                notes: formData.notes || '',
                status: formData.status || 'Planned',
                recurring_days: formData.recurringDays,
                recurring_end_date: formData.recurringEndDate
              }

              const transformedEvent = await api.createEvent(apiData)
              createdEvents.push(transformedEvent)
            }
          }
          
          setEvents((current = []) => [...current, ...createdEvents])
          toast.success(`Created ${createdEvents.length} recurring events successfully`)
        } else {
          // Single event creation
          const apiData = {
            team_id: formData.teamIds && formData.teamIds.length > 0 ? parseInt(formData.teamIds[0]) : null,
            team_ids: formData.teamIds && formData.teamIds.length > 0 ? formData.teamIds.join(',') : null,
            field_id: formData.fieldId ? parseInt(formData.fieldId) : null,
            event_type: formData.eventType,
            start_time: `${formData.date}T${formData.startTime}:00`,
            end_time: `${formData.date}T${formData.endTime}:00`,
            description: formData.title || '',
            notes: formData.notes || '',
            status: formData.status || 'Planned',
            recurring_days: null,
            recurring_end_date: null
          }

          const transformedEvent = await api.createEvent(apiData)
          setEvents((current = []) => [...current, transformedEvent])
          toast.success('Event created successfully')
        }
      }
      
      setShowDialog(false)
    } catch (error: any) {
      console.error('Error saving event:', error)
      toast.error(error.message || 'Failed to save event')
    }
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

  // Filter and sort events
  const filteredAndSortedEvents = useMemo(() => {
    let filtered = [...events]

    // Filter by team
    if (filterTeam !== 'all') {
      filtered = filtered.filter(event => 
        event.teamIds && event.teamIds.includes(filterTeam)
      )
    }

    // Filter by event type
    if (filterEventType !== 'all') {
      filtered = filtered.filter(event => event.eventType === filterEventType)
    }

    // Filter by date range
    if (filterStartDate) {
      filtered = filtered.filter(event => event.date >= filterStartDate)
    }
    if (filterEndDate) {
      filtered = filtered.filter(event => event.date <= filterEndDate)
    }

    // Sort by date (ascending) and then by start time
    filtered.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.startTime.localeCompare(b.startTime)
    })

    return filtered
  }, [events, filterTeam, filterEventType, filterStartDate, filterEndDate])

  const clearFilters = () => {
    setFilterTeam('all')
    setFilterEventType('all')
    setFilterStartDate('')
    setFilterEndDate('')
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

      {/* Filter Controls */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-3">
            <FunnelSimple size={20} style={{ color: COLORS.NAVY }} />
            <span className="font-medium" style={{ color: COLORS.NAVY }}>Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filterTeam" className="text-xs">Team</Label>
              <Select value={filterTeam} onValueChange={setFilterTeam}>
                <SelectTrigger id="filterTeam" className="h-9">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {activeTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filterEventType" className="text-xs">Event Type</Label>
              <Select value={filterEventType} onValueChange={setFilterEventType}>
                <SelectTrigger id="filterEventType" className="h-9">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Game">Game</SelectItem>
                  <SelectItem value="Practice">Practice</SelectItem>
                  <SelectItem value="Meeting">Meeting</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filterStartDate" className="text-xs">From Date</Label>
              <Input
                id="filterStartDate"
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filterEndDate" className="text-xs">To Date</Label>
              <Input
                id="filterEndDate"
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          {(filterTeam !== 'all' || filterEventType !== 'all' || filterStartDate || filterEndDate) && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Showing {filteredAndSortedEvents.length} of {events.length} events
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-8 text-xs"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredAndSortedEvents.map((event) => (
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
                {currentUser && (currentUser.role === 'admin' || currentUser.role === 'mgmt') && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#248bcc] hover:text-[#248bcc] hover:bg-[#248bcc]/10"
                      onClick={() => handleEdit(event)}
                      title="Edit event"
                    >
                      <PencilSimple size={18} weight="bold" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(event.id)}
                      title="Delete event"
                    >
                      <Trash size={18} weight="bold" />
                    </Button>
                  </div>
                )}
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
        <DialogContent 
          className="max-w-3xl max-h-[90vh] overflow-y-auto operations-dialog"
          style={{
            background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)',
            border: `3px solid ${COLORS.NAVY}`,
            boxShadow: '0 20px 60px rgba(0, 31, 63, 0.3)'
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: COLORS.NAVY }}>
              {editingEvent ? 'Edit Event' : 'Create Event'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" style={{ color: COLORS.CHARCOAL }}>Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eventType" style={{ color: COLORS.CHARCOAL }}>Event Type *</Label>
                <Select 
                  value={formData.eventType || 'Practice'} 
                  onValueChange={(v) => setFormData({ ...formData, eventType: v as EventType })}
                  required
                >
                  <SelectTrigger id="eventType" style={{ color: COLORS.CHARCOAL }}>
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
                <Label htmlFor="status" style={{ color: COLORS.CHARCOAL }}>Status *</Label>
                <Select 
                  value={formData.status || 'Planned'} 
                  onValueChange={(v) => setFormData({ ...formData, status: v as EventStatus })}
                  required
                >
                  <SelectTrigger id="status" style={{ color: COLORS.CHARCOAL }}>
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
                <Label htmlFor="date" style={{ color: COLORS.CHARCOAL }}>Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime" style={{ color: COLORS.CHARCOAL }}>Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime" style={{ color: COLORS.CHARCOAL }}>End Time *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field" style={{ color: COLORS.CHARCOAL }}>Field</Label>
              <Select 
                value={formData.fieldId || ''} 
                onValueChange={(v) => setFormData({ ...formData, fieldId: v })}
              >
                <SelectTrigger id="field" style={{ color: COLORS.CHARCOAL }}>
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
              <Label style={{ color: COLORS.CHARCOAL }}>Teams</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-32 overflow-y-auto">
                {activeTeams.map(team => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-team-${team.id}`}
                      checked={formData.teamIds?.includes(team.id)}
                      onCheckedChange={() => handleTeamToggle(team.id)}
                    />
                    <label htmlFor={`event-team-${team.id}`} className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>
                      {team.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otherParticipants" style={{ color: COLORS.CHARCOAL }}>Other Participants</Label>
              <Input
                id="otherParticipants"
                value={formData.otherParticipants}
                onChange={(e) => setFormData({ ...formData, otherParticipants: e.target.value })}
                placeholder="Specify other participants..."
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendance" style={{ color: COLORS.CHARCOAL }}>Estimated Attendance</Label>
              <Input
                id="attendance"
                type="number"
                value={formData.estimatedAttendance || ''}
                onChange={(e) => setFormData({ ...formData, estimatedAttendance: e.target.value ? parseInt(e.target.value) : undefined })}
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" style={{ color: COLORS.CHARCOAL }}>Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                style={{ color: COLORS.CHARCOAL }}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
                  style={{
                    backgroundColor: formData.isRecurring ? COLORS.NAVY : undefined
                  }}
                />
                <Label htmlFor="isRecurring" style={{ color: COLORS.CHARCOAL }}>Recurring Event</Label>
              </div>

              {formData.isRecurring && (
                <div className="space-y-3 pl-6 border-l-2">
                  <div className="space-y-2">
                    <Label style={{ color: COLORS.CHARCOAL }}>Weekdays</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {WEEKDAYS.map(day => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={formData.recurringDays?.includes(day.value)}
                            onCheckedChange={() => handleDayToggle(day.value)}
                          />
                          <label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurringEndDate" style={{ color: COLORS.CHARCOAL }}>End Date *</Label>
                    <Input
                      id="recurringEndDate"
                      type="date"
                      value={formData.recurringEndDate}
                      onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                      required={formData.isRecurring}
                      style={{ color: COLORS.CHARCOAL }}
                    />
                  </div>
                </div>
              )}
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
                {editingEvent ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
