import { useState, useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { Event, EventType, EventStatus, Team, Field, User } from '@/lib/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, PencilSimple, CalendarBlank, Trash, FunnelSimple, MagicWand, ShareNetwork, Envelope } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { COLORS } from '@/lib/constants'
import { shareEvent } from '@/lib/whatsappService'
import NaturalLanguageEventCreator from '@/components/NaturalLanguageEventCreator'
import EventUpdateShareDialog from '@/components/EventUpdateShareDialog'

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

  // Share dialog state
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareDialogEvent, setShareDialogEvent] = useState<Event | null>(null)
  const [shareDialogOriginalEvent, setShareDialogOriginalEvent] = useState<Event | null>(null)
  const [shareDialogUpdateType, setShareDialogUpdateType] = useState<'update' | 'cancel' | 'create'>('update')

  // AI Creator toggle
  const [showAICreator, setShowAICreator] = useState(false)

  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null)
  const [sendCancellationEmail, setSendCancellationEmail] = useState(false)

  // Filter state
  const [filterTeam, setFilterTeam] = useState<string>('all')
  const [filterEventType, setFilterEventType] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')

  const [formData, setFormData] = useState<Partial<Event> & { estimatedAttendance?: number | string }>({
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

  // Calculate how many recurring events will be created
  const calculateRecurringCount = () => {
    if (!formData.isRecurring || !formData.date || !formData.recurringEndDate || !formData.recurringDays || formData.recurringDays.length === 0) {
      return 0
    }
    
    const startDate = new Date(formData.date)
    const endDate = new Date(formData.recurringEndDate)
    const selectedDays = formData.recurringDays
    
    let count = 0
    const current = new Date(startDate)
    current.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay()
      if (selectedDays.includes(dayOfWeek)) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    
    return count
  }

  const recurringEventCount = calculateRecurringCount()

  const activeTeams = teams.filter(t => t.isActive)
  
  // Get location options based on event type
  // For Meeting/Other: show fields from non-sports facilities (sites)
  // For Game/Practice: show fields from sports facilities
  const locationOptions = useMemo(() => {
    if (!formData.eventType) {
      // No event type selected, show all fields
      return fields
        .filter((f: any) => {
          const site = (sites || []).find((s: any) => s.id === f.siteId)
          return f.isActive && site?.isActive
        })
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          siteName: (sites || []).find((s: any) => s.id === f.siteId)?.name
        }))
    }
    
    if (formData.eventType === 'Meeting' || formData.eventType === 'Other') {
      // For meetings/other, show fields from non-sports facility sites
      return fields
        .filter((f: any) => {
          const site = (sites || []).find((s: any) => s.id === f.siteId)
          return f.isActive && site?.isActive && site?.isSportsFacility === false
        })
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          siteName: (sites || []).find((s: any) => s.id === f.siteId)?.name
        }))
    }
    
    // For games/practice, show fields from sports facilities
    return fields
      .filter((f: any) => {
        const site = (sites || []).find((s: any) => s.id === f.siteId)
        return f.isActive && site?.isActive && site?.isSportsFacility === true
      })
      .map((f: any) => ({
        id: f.id,
        name: f.name,
        siteName: (sites || []).find((s: any) => s.id === f.siteId)?.name
      }))
  }, [formData.eventType, fields, sites])

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
    // Populate form including recurring data if it exists
    setFormData({
      ...event,
      isRecurring: event.isRecurring || false,
      recurringDays: event.recurringDays || [],
      recurringEndDate: event.recurringEndDate || ''
    })
    setShowDialog(true)
  }

  const handleShare = async (event: Event) => {
    try {
      const success = await shareEvent(event, teams, fields, sites)
      if (success) {
        toast.success('Event shared!')
      }
    } catch (error) {
      console.error('Error sharing event:', error)
      toast.error('Failed to share event')
    }
  }

  const handleNotifyCancellation = (event: Event) => {
    const field = fields.find(f => f.id === event.fieldId)
    const site = field ? sites.find(s => s.id === field.siteId) : null
    
    if (!site?.contactEmail) {
      toast.error('No site contact email available')
      return
    }

    const eventTeams = event.teamIds ? teams.filter(t => event.teamIds?.includes(t.id)) : []
    const formattedDate = new Date(event.date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
    const teamNames = eventTeams.map(t => t.name).join(', ') || 'N/A'
    const locationName = field ? `${site.name} - ${field.name}` : site?.name || 'N/A'

    // Collect CC recipients: site contact, team managers and coaches
    // Always include bewilligungen@igacr.ch for permit coordination
    const ccRecipients: string[] = ['bewilligungen@igacr.ch']
    
    // Add site contact email to CC
    if (site?.contactEmail) {
      ccRecipients.push(site.contactEmail)
    }
    
    // Add team managers and coaches emails to CC
    eventTeams.forEach(team => {
      if (team.headCoach?.email) {
        ccRecipients.push(team.headCoach.email)
      }
      if (team.teamManager?.email) {
        ccRecipients.push(team.teamManager.email)
      }
    })
    
    // Remove duplicates
    const uniqueCcRecipients = [...new Set(ccRecipients)]

    const subject = encodeURIComponent(
      `CANCELLED: ${event.eventType} on ${formattedDate} at ${event.startTime} - ${locationName} (${teamNames})`
    )

    const body = encodeURIComponent(
      `Dear ${site.contactFirstName} ${site.contactLastName},\n\n` +
      `We regret to inform you that the following event has been cancelled:\n\n` +
      `Event: ${event.title}\n` +
      `Type: ${event.eventType}\n` +
      `Date: ${formattedDate}\n` +
      `Time: ${event.startTime} - ${event.endTime}\n` +
      `Location: ${locationName}\n` +
      `Address: ${site.address}, ${site.zipCode} ${site.city}\n` +
      `Team(s): ${teamNames}\n\n` +
      `We apologize for any inconvenience this may cause.\n\n` +
      `Please let us know if you have any questions or if there is anything we need to arrange regarding this cancellation.\n\n` +
      `Best regards,\n` +
      `Renegades Organization`
    )

    const ccParam = uniqueCcRecipients.length > 0 ? `&cc=${uniqueCcRecipients.join(',')}` : ''
    window.location.href = `mailto:sports@renegades.ch?subject=${subject}&body=${body}${ccParam}`
  }

  const handleDeleteClick = (event: Event) => {
    setEventToDelete(event)
    setSendCancellationEmail(false)
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return
    
    try {
      const numericId = parseInt(eventToDelete.id)
      if (!isNaN(numericId)) {
        await api.deleteEvent(numericId)
      }
      
      // Send cancellation email if requested
      if (sendCancellationEmail) {
        handleNotifyCancellation(eventToDelete)
      }
      
      setEvents((current = []) => current.filter(ev => ev.id !== eventToDelete.id))
      toast.success('Event deleted successfully')
    } catch (error: any) {
      console.error('Error deleting event:', error)
      toast.error(error.message || 'Failed to delete event')
    } finally {
      setShowDeleteDialog(false)
      setEventToDelete(null)
      setSendCancellationEmail(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (formData.status === 'Confirmed' && !formData.fieldId) {
        toast.error('Cannot confirm an event without a location')
        return
      }

      // Validate recurring fields when isRecurring is enabled (both create and edit)
      if (formData.isRecurring && (!formData.recurringDays || formData.recurringDays.length === 0)) {
        toast.error('Please select at least one weekday for the recurring event')
        return
      }

      if (formData.isRecurring && !formData.recurringEndDate) {
        toast.error('Please specify an end date for the recurring event')
        return
      }

      if (editingEvent) {
        // Editing existing event
        const apiData = {
          team_ids: formData.teamIds && formData.teamIds.length > 0 ? formData.teamIds.join(',') : null,
          field_id: formData.fieldId ? parseInt(formData.fieldId) : null,
          event_type: formData.eventType,
          start_time: `${formData.date}T${formData.startTime}:00`,
          end_time: `${formData.date}T${formData.endTime}:00`,
          description: formData.title || '',
          notes: formData.notes || '',
          status: formData.status || 'Planned',
          recurring_days: formData.isRecurring && formData.recurringDays ? formData.recurringDays.join(',') : null,
          recurring_end_date: formData.isRecurring && formData.recurringEndDate ? formData.recurringEndDate : null,
          generate_recurring: formData.isRecurring, // Flag to generate recurring events
          other_participants: formData.otherParticipants || null,
          estimated_attendance: formData.estimatedAttendance ? 
            (typeof formData.estimatedAttendance === 'string' ? parseInt(formData.estimatedAttendance) : formData.estimatedAttendance) : null
        }

        console.log('[ScheduleManager] Updating event with data:', apiData)
        
        const numericId = parseInt(editingEvent.id)
        if (!isNaN(numericId)) {
          const result = await api.updateEvent(numericId, apiData)
          
          // Handle both single event and array of events (when converting to recurring)
          if (Array.isArray(result)) {
            // Multiple events created (converted to recurring)
            // Remove the original event and add all new ones
            setEvents((current = []) => [
              ...current.filter(ev => ev.id !== editingEvent.id),
              ...result
            ])
            toast.success(`Event converted to recurring: ${result.length} events created`)
          } else {
            // Single event updated
            setEvents((current = []) =>
              current.map(ev => ev.id === editingEvent.id ? result : ev)
            )
            toast.success('Event updated successfully')
            
            // Show share dialog for event updates
            const isCancellation = formData.status === 'Cancelled' && editingEvent.status !== 'Cancelled'
            setShareDialogOriginalEvent(editingEvent)
            setShareDialogEvent(result)
            setShareDialogUpdateType(isCancellation ? 'cancel' : 'update')
            setShowShareDialog(true)
          }
        }
      } else {
        // Creating new event
        const apiData = {
          team_ids: formData.teamIds && formData.teamIds.length > 0 ? formData.teamIds.join(',') : null,
          field_id: formData.fieldId ? parseInt(formData.fieldId) : null,
          event_type: formData.eventType,
          start_time: `${formData.date}T${formData.startTime}:00`,
          end_time: `${formData.date}T${formData.endTime}:00`,
          description: formData.title || '',
          notes: formData.notes || '',
          status: formData.status || 'Planned',
          recurring_days: formData.isRecurring && formData.recurringDays ? formData.recurringDays.join(',') : null,
          recurring_end_date: formData.isRecurring && formData.recurringEndDate ? formData.recurringEndDate : null,
          other_participants: formData.otherParticipants || null,
          estimated_attendance: formData.estimatedAttendance ? 
            (typeof formData.estimatedAttendance === 'string' ? parseInt(formData.estimatedAttendance) : formData.estimatedAttendance) : null
        }

        console.log('[ScheduleManager] Creating event with data:', apiData)
        console.log('[ScheduleManager] Is recurring:', formData.isRecurring)
        console.log('[ScheduleManager] Recurring days:', formData.recurringDays)
        console.log('[ScheduleManager] Recurring end date:', formData.recurringEndDate)
        console.log('[ScheduleManager] Expected count:', recurringEventCount)

        const result = await api.createEvent(apiData)
        
        console.log('[ScheduleManager] Result from API:', result)
        console.log('[ScheduleManager] Result is array:', Array.isArray(result))
        
        // Handle both single event and array of events (for recurring)
        if (Array.isArray(result)) {
          // Multiple events created (recurring)
          setEvents((current = []) => [...current, ...result])
          toast.success(`${result.length} recurring events created successfully`)
        } else {
          // Single event created
          setEvents((current = []) => [...current, result])
          toast.success('Event created successfully')
        }
      }
      
      setShowDialog(false)
    } catch (error: any) {
      console.error('Error saving event:', error)
      
      // Handle field booking conflicts
      if (error.status === 409) {
        toast.error(error.message || 'Field booking conflict detected', {
          duration: 5000,
          description: error.conflictingEvent ? 
            'This time slot is already booked for another game.' : 
            undefined
        })
      } else {
        toast.error(error.message || 'Failed to save event')
      }
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
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowAICreator(!showAICreator)}
            style={{ backgroundColor: '#8B5CF6', color: 'white' }}
            className="hover:opacity-90"
          >
            <MagicWand className="mr-2" size={16} />
            AI Create
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2" size={16} />
            Add Event
          </Button>
        </div>
      </div>

      {/* AI Event Creator */}
      {showAICreator && (
        <NaturalLanguageEventCreator
          teams={activeTeams.map(t => ({ id: parseInt(t.id), name: t.name }))}
          fields={fields.map(f => ({ id: parseInt(f.id), name: f.name, siteId: f.siteId }))}
          sites={sites.map(s => ({ id: parseInt(s.id), name: s.name }))}
          onEventsCreated={() => {
            // Refresh events
            api.getEvents().then(setEvents)
            setShowAICreator(false)
          }}
        />
      )}

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
                    {event.status === 'Cancelled' && (() => {
                      const field = fields.find(f => f.id === event.fieldId)
                      const site = field ? sites.find(s => s.id === field.siteId) : null
                      return site?.contactEmail ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-amber-600 hover:text-amber-600 hover:bg-amber-600/10"
                          onClick={() => handleNotifyCancellation(event)}
                          title="Notify site contact of cancellation"
                        >
                          <Envelope size={18} weight="bold" />
                        </Button>
                      ) : null
                    })()}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600 hover:text-green-600 hover:bg-green-600/10"
                      onClick={() => handleShare(event)}
                      title="Share event"
                    >
                      <ShareNetwork size={18} weight="bold" />
                    </Button>
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
                      onClick={() => handleDeleteClick(event)}
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
          className="w-[95vw] max-w-3xl max-h-[95vh] overflow-y-auto operations-dialog p-4 sm:p-6"
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
          <form onSubmit={handleSubmit} className="space-y-4 pb-20 sm:pb-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <Label htmlFor="field" style={{ color: COLORS.CHARCOAL }}>
                Location
                {formData.eventType === 'Meeting' || formData.eventType === 'Other' ? ' (Site)' : ' (Field)'}
              </Label>
              <Select 
                value={formData.fieldId || ''} 
                onValueChange={(v) => setFormData({ ...formData, fieldId: v })}
              >
                <SelectTrigger id="field" style={{ color: COLORS.CHARCOAL }}>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locationOptions.map((location: any) => (
                    <SelectItem key={location.id} value={location.id}>
                      {formData.eventType === 'Meeting' || formData.eventType === 'Other' 
                        ? location.siteName 
                        : `${location.siteName} - ${location.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: COLORS.CHARCOAL }}>Teams</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-md max-h-32 overflow-y-auto">
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

            {/* Recurring options available for both create and edit */}
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
                <div className="space-y-3 pl-6 border-l-2" style={{ borderColor: COLORS.ACCENT }}>
                  <div className="space-y-2">
                    <Label style={{ color: COLORS.CHARCOAL }}>Weekdays *</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
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
                      min={formData.date}
                      style={{ color: COLORS.CHARCOAL }}
                    />
                  </div>
                  {recurringEventCount > 0 && (
                    <div 
                      className="p-3 rounded-md text-sm font-medium"
                      style={{
                        backgroundColor: 'rgba(36, 139, 204, 0.1)',
                        color: COLORS.ACCENT,
                        border: `1px solid ${COLORS.ACCENT}`
                      }}
                    >
                      📅 {recurringEventCount} individual event{recurringEventCount !== 1 ? 's' : ''} will be created
                    </div>
                  )}
                </div>
              )}
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
                {editingEvent ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Event Update Share Dialog */}
      {shareDialogEvent && (
        <EventUpdateShareDialog
          isOpen={showShareDialog}
          onClose={() => {
            setShowShareDialog(false)
            setShareDialogEvent(null)
            setShareDialogOriginalEvent(null)
          }}
          event={shareDialogEvent}
          originalEvent={shareDialogOriginalEvent}
          teams={teams}
          fields={fields}
          sites={sites}
          updateType={shareDialogUpdateType}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
              {eventToDelete && (
                <div className="mt-3 p-3 bg-muted rounded-lg text-sm text-foreground">
                  <div className="font-medium">{eventToDelete.title}</div>
                  <div className="text-muted-foreground">
                    {eventToDelete.date} • {eventToDelete.startTime} - {eventToDelete.endTime}
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {/* Cancellation email option */}
          {eventToDelete && (() => {
            const field = fields.find(f => f.id === eventToDelete.fieldId)
            const site = field ? sites.find(s => s.id === field.siteId) : null
            const hasContactEmail = site?.contactEmail
            
            return hasContactEmail ? (
              <div className="flex items-start gap-3 py-2 px-1">
                <Checkbox
                  id="send-cancellation-email"
                  checked={sendCancellationEmail}
                  onCheckedChange={(checked) => setSendCancellationEmail(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="send-cancellation-email"
                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                  >
                    <Envelope size={16} className="text-amber-600" />
                    Send cancellation email
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Notify site contact and team staff about this cancellation
                  </p>
                </div>
              </div>
            ) : null
          })()}
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
