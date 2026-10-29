import { useState, useMemo, useRef, useEffect } from 'react'
import { useData } from '@/contexts/DataContext'
import { Event, EventType, EventStatus, GameLocation, Team, Field, User } from '@/lib/types'
import { api, apiRequest, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OperationsCardGrid, OperationsCardHeader, OperationsCardSection } from './OperationsCards'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, PencilSimple, CalendarBlank, Trash, FunnelSimple, MagicWand, ShareNetwork, Envelope, FileXls, House, MapPin, Bus, CloudArrowUp } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { COLORS } from '@/lib/constants'
import { shareEvent } from '@/lib/whatsappService'
import { getToken } from '@/lib/api'
import NaturalLanguageEventCreator from '@/components/NaturalLanguageEventCreator'
import EventUpdateShareDialog from '@/components/EventUpdateShareDialog'
import ScheduleExportDialog from '@/components/ScheduleExportDialog'
import { useCapabilities } from '@/hooks/useCapabilities'
import { formatEventTimeRange } from '@/lib/utils'
import { usePublishedSchedules } from '@/hooks/usePublishedSchedules'
import { publishedScheduleKey, publishedSites } from '@/lib/publishedSchedule'
import PublishedBookingCheck from './PublishedBookingCheck'
import SharedFieldNotice, { SharedFieldBadge } from '../SharedFieldNotice'

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

function formatBookingInterval(start: string, end: string) {
  return `${start.slice(0, 10)} ${formatEventTimeRange({
    date: start.slice(0, 10), endDate: end.slice(0, 10),
    startTime: start.slice(11, 16), endTime: end.slice(11, 16),
  })}`
}

// Generates a draft only; the operator's mail client sends it.
async function sendTransportRequest(eventId: string | number): Promise<void> {
  try {
    const result = await apiRequest<{ email: { to: string; cc: string[]; subject: string; body: string } }>(`/events/${eventId}/transport-request`, {
      method: 'POST',
    })
    const { to, cc, subject, body } = result.email
    const ccParam = cc.length > 0 ? `&cc=${encodeURIComponent(cc.join(','))}` : ''
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}${ccParam}&body=${encodeURIComponent(body)}`
  } catch (error) {
    console.error('[ScheduleManager] Error sending transport request:', error)
    toast.error('The event was saved, but its transport draft could not be generated. Do not create the event again.')
  }
}

export default function ScheduleManager({ currentUser }: ScheduleManagerProps) {
  const { capabilities } = useCapabilities()
  const { events, setEvents, teams, fields, sites, eventWindow } = useData()
  const [showDialog, setShowDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)
  const conflictRef = useRef<HTMLElement>(null)
  const [conflictReview, setConflictReview] = useState<{
    draftKey: string
    details: NonNullable<ApiError['bookingConflict']>
  } | null>(null)

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
  const [alsoDeleteFromSpond, setAlsoDeleteFromSpond] = useState(false)

  // Filter state
  const [filterTeam, setFilterTeam] = useState<string>('all')
  const [filterEventType, setFilterEventType] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false)

  const [formData, setFormData] = useState<Partial<Event> & { estimatedAttendance?: number | string }>({
    title: '',
    eventType: 'Practice',
    status: 'Planned',
    date: '',
    startTime: '',
    endTime: '',
    fieldIds: [],
    teamIds: [],
    otherParticipants: '',
    estimatedAttendance: undefined,
    notes: '',
    isRecurring: false,
    recurringDays: [],
    recurringEndDate: '',
    // Game location fields
    gameLocation: undefined,
    awayStreet: '',
    awayZip: '',
    awayCity: '',
    transportRequested: false
  })

  const draftKey = JSON.stringify({ formData, editingId: editingEvent?.id })
  const activeConflictReview = conflictReview?.draftKey === draftKey ? conflictReview.details : null
  const canOverrideConflict = !!currentUser && ['admin', 'mgmt'].includes(currentUser.role)
  useEffect(() => {
    if (activeConflictReview) conflictRef.current?.focus()
  }, [activeConflictReview])

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
          siteId: f.siteId,
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
          siteId: f.siteId,
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
        siteId: f.siteId,
        siteName: (sites || []).find((s: any) => s.id === f.siteId)?.name
      }))
  }, [formData.eventType, fields, sites])

  // Group location options by site for display
  const locationsBysite = useMemo(() => {
    const grouped: { [siteId: string]: { siteName: string, fields: typeof locationOptions } } = {}
    for (const loc of locationOptions) {
      if (!grouped[loc.siteId]) {
        grouped[loc.siteId] = { siteName: loc.siteName || 'Unknown', fields: [] }
      }
      grouped[loc.siteId].fields.push(loc)
    }
    return grouped
  }, [locationOptions])

  // Get the site ID of the first selected field (to show only fields from same site)
  const selectedSiteId = useMemo(() => {
    if (!formData.fieldIds || formData.fieldIds.length === 0) return null
    const fieldIds = formData.fieldIds
    const firstField = locationOptions.find((loc: any) => loc.id === fieldIds[0])
    return firstField?.siteId || null
  }, [formData.fieldIds, locationOptions])

  const handleCreate = () => {
    setConflictReview(null)
    setEditingEvent(null)
    setFormData({
      title: '',
      eventType: 'Practice',
      status: 'Planned',
      date: '',
      startTime: '',
      endTime: '',
      fieldIds: [],
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
    setConflictReview(null)
    setEditingEvent(event)
    // Populate form including recurring data and game location if it exists
    setFormData({
      ...event,
      fieldIds: event.fieldIds || [],
      isRecurring: event.isRecurring || false,
      recurringDays: event.recurringDays || [],
      recurringEndDate: event.recurringEndDate || '',
      gameLocation: event.gameLocation || undefined,
      awayStreet: event.awayStreet || '',
      awayZip: event.awayZip || '',
      awayCity: event.awayCity || '',
      transportRequested: event.transportRequested || false
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
    const eventFieldIds = event.fieldIds || []
    const eventFields = eventFieldIds.map(id => fields.find(f => f.id === id)).filter(Boolean)
    const primaryField = eventFields[0]
    const site = primaryField ? sites.find(s => s.id === primaryField.siteId) : null
    const eventTeams = event.teamIds ? teams.filter(t => event.teamIds?.includes(t.id)) : []
    const formattedDate = new Date(event.date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
    const teamNames = eventTeams.map(t => t.name).join(', ') || 'N/A'
    const fieldNames = eventFields.map(f => f?.name).join(', ')
    const locationName = site && fieldNames ? `${site.name} - ${fieldNames}` : fieldNames || site?.name || 'TBD'

    // Collect TO recipients: site manager, team coach, team manager
    const toRecipients: string[] = []
    
    // Add site contact email to TO
    if (site?.contactEmail) {
      toRecipients.push(site.contactEmail)
    }
    
    // Add team coaches and managers to TO
    eventTeams.forEach(team => {
      if (team.headCoach?.email) {
        toRecipients.push(team.headCoach.email)
      }
      if (team.teamManager?.email) {
        toRecipients.push(team.teamManager.email)
      }
    })
    
    // Remove duplicates
    const uniqueToRecipients = [...new Set(toRecipients)]
    
    const subject = encodeURIComponent(
      `CANCELLED: ${event.eventType} on ${formattedDate} at ${event.startTime} - ${locationName} (${teamNames})`
    )

    const body = encodeURIComponent(
      `The following event has been cancelled:\n\n` +
      `Event: ${event.title}\n` +
      `Type: ${event.eventType}\n` +
      `Date: ${formattedDate}\n` +
      `Time: ${formatEventTimeRange(event)}\n` +
      `Location: ${locationName}\n` +
      (site ? `Address: ${site.address}, ${site.zipCode} ${site.city}\n` : '') +
      `Team(s): ${teamNames}\n\n` +
      `We apologize for any inconvenience this may cause.\n\n` +
      `Please let us know if you have any questions or if there is anything we need to arrange regarding this cancellation.\n\n` +
      `Club operations`
    )

    const toParam = uniqueToRecipients.join(',')
    window.location.href = `mailto:${toParam}?subject=${subject}&body=${body}`
  }

  const handleDeleteClick = (event: Event) => {
    setEventToDelete(event)
    setSendCancellationEmail(false)
    setAlsoDeleteFromSpond(false)
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
      
      // Also delete from Spond if requested and the event is linked
      if (capabilities?.spond && alsoDeleteFromSpond && eventToDelete.spondId) {
        try {
          // The Spond API doesn't have a delete method, but we can cancel it
          // by updating the event status in Spond
          const response = await fetch(`/api/spond/push/event/${numericId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ status: 'cancelled' }),
          })
          if (!response.ok) throw new Error('Spond rejected the cancellation')
          toast.success('Event also cancelled in Spond')
        } catch (spondError) {
          console.error('Error deleting from Spond:', spondError)
          toast.error('Event deleted locally but failed to update Spond')
        }
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
      setAlsoDeleteFromSpond(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveEvent()
  }

  const saveEvent = async (allowConflicts = false) => {
    if (savingRef.current || (allowConflicts && (!activeConflictReview || !canOverrideConflict))) return
    savingRef.current = true
    setIsSaving(true)
    setConflictReview(null)
    try {
      // For Confirmed events, require at least one location (unless it's an away game)
      const isAwayGame = formData.eventType === 'Game' && formData.gameLocation === 'away'
      if (formData.status === 'Confirmed' && !isAwayGame && (!formData.fieldIds || formData.fieldIds.length === 0)) {
        toast.error('Confirmed events require at least one location to be specified')
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

      const start = Date.parse(`${formData.date}T${formData.startTime}Z`)
      const end = Date.parse(`${formData.endDate || formData.date}T${formData.endTime}Z`)
      const lastEnd = formData.isRecurring && formData.recurringEndDate
        ? Date.parse(`${formData.recurringEndDate}T${formData.startTime}Z`) + end - start
        : end
      if (allowConflicts && formData.fieldIds?.length &&
          (start < Date.parse(eventWindow.from) || lastEnd > Date.parse(eventWindow.to))) {
        // Load peers before saving so out-of-window overrides also show shared use immediately.
        const peers: Event[] = []
        for (let from = start; from < lastEnd; from += 366 * 86400000) {
          peers.push(...await api.getEvents({
            from: new Date(from).toISOString(),
            to: new Date(Math.min(lastEnd, from + 366 * 86400000)).toISOString(),
          }))
        }
        setEvents(current => [...new Map([...current, ...peers].map(event => [event.id, event])).values()])
      }

      if (editingEvent) {
        // Editing existing event
        const apiData = {
          allow_conflicts: allowConflicts,
          team_ids: formData.teamIds && formData.teamIds.length > 0 ? formData.teamIds.join(',') : null,
          field_ids: formData.fieldIds && formData.fieldIds.length > 0 ? formData.fieldIds.join(',') : null,
          event_type: formData.eventType,
          start_time: `${formData.date}T${formData.startTime}:00`,
          end_time: `${formData.endDate || formData.date}T${formData.endTime}:00`,
          description: formData.title || '',
          notes: formData.notes || '',
          status: formData.status || 'Planned',
          recurring_days: formData.isRecurring && formData.recurringDays ? formData.recurringDays.join(',') : null,
          recurring_end_date: formData.isRecurring && formData.recurringEndDate ? formData.recurringEndDate : null,
          generate_recurring: formData.isRecurring, // Flag to generate recurring events
          other_participants: formData.otherParticipants || null,
          estimated_attendance: formData.estimatedAttendance ? 
            (typeof formData.estimatedAttendance === 'string' ? parseInt(formData.estimatedAttendance) : formData.estimatedAttendance) : null,
          // Game location fields
          game_location: formData.eventType === 'Game' ? (formData.gameLocation || null) : null,
          away_street: formData.eventType === 'Game' && formData.gameLocation === 'away' ? (formData.awayStreet || null) : null,
          away_zip: formData.eventType === 'Game' && formData.gameLocation === 'away' ? (formData.awayZip || null) : null,
          away_city: formData.eventType === 'Game' && formData.gameLocation === 'away' ? (formData.awayCity || null) : null,
          transport_requested: formData.eventType === 'Game' && formData.gameLocation === 'away' ? (formData.transportRequested || false) : false
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
          allow_conflicts: allowConflicts,
          team_ids: formData.teamIds && formData.teamIds.length > 0 ? formData.teamIds.join(',') : null,
          field_ids: formData.fieldIds && formData.fieldIds.length > 0 ? formData.fieldIds.join(',') : null,
          event_type: formData.eventType,
          start_time: `${formData.date}T${formData.startTime}:00`,
          end_time: `${formData.endDate || formData.date}T${formData.endTime}:00`,
          description: formData.title || '',
          notes: formData.notes || '',
          status: formData.status || 'Planned',
          recurring_days: formData.isRecurring && formData.recurringDays ? formData.recurringDays.join(',') : null,
          recurring_end_date: formData.isRecurring && formData.recurringEndDate ? formData.recurringEndDate : null,
          other_participants: formData.otherParticipants || null,
          estimated_attendance: formData.estimatedAttendance ? 
            (typeof formData.estimatedAttendance === 'string' ? parseInt(formData.estimatedAttendance) : formData.estimatedAttendance) : null,
          // Game location fields
          game_location: formData.eventType === 'Game' ? (formData.gameLocation || null) : null,
          away_street: formData.eventType === 'Game' && formData.gameLocation === 'away' ? (formData.awayStreet || null) : null,
          away_zip: formData.eventType === 'Game' && formData.gameLocation === 'away' ? (formData.awayZip || null) : null,
          away_city: formData.eventType === 'Game' && formData.gameLocation === 'away' ? (formData.awayCity || null) : null,
          transport_requested: formData.eventType === 'Game' && formData.gameLocation === 'away' ? (formData.transportRequested || false) : false
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
          
          // Do not generate hundreds of SQL requests or mail-client navigations.
          if (capabilities?.transport && formData.transportRequested && formData.gameLocation === 'away') {
            toast.info('Events saved. Open transport drafts individually using the bus button on each away game.')
          }
        } else {
          // Single event created
          setEvents((current = []) => [...current, result])
          toast.success('Event created successfully')
          
          // Show share dialog for newly created event (includes Spond push option)
          setShareDialogOriginalEvent(null)
          setShareDialogEvent(result)
          setShareDialogUpdateType('create')
          setShowShareDialog(true)
          
          // Send transport request for away games
          if (capabilities?.transport && formData.transportRequested && formData.gameLocation === 'away') {
            await sendTransportRequest(result.id)
          }
        }
      }
      
      setShowDialog(false)
    } catch (error: unknown) {
      console.error('Error saving event:', error)
      if (error instanceof ApiError && error.bookingConflict) {
        setConflictReview({ draftKey, details: error.bookingConflict })
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to save event')
      }
    } finally {
      savingRef.current = false
      setIsSaving(false)
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

  const handleFieldToggle = (fieldId: string) => {
    setFormData((prev) => ({
      ...prev,
      fieldIds: prev.fieldIds?.includes(fieldId)
        ? prev.fieldIds.filter(id => id !== fieldId)
        : [...(prev.fieldIds || []), fieldId]
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

  const canCheckPublished = !!currentUser && ['admin', 'mgmt'].includes(currentUser.role)
  const published = usePublishedSchedules(filteredAndSortedEvents, sites, fields, capabilities?.timezone, canCheckPublished)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Schedule Management</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowExportDialog(true)}
          >
            <FileXls className="mr-2" size={16} />
            Export
          </Button>
          {capabilities?.ai && <Button
            onClick={() => setShowAICreator(!showAICreator)}
            style={{ backgroundColor: '#8B5CF6', color: 'white' }}
            className="hover:opacity-90"
          >
            <MagicWand className="mr-2" size={16} />
            AI Create
          </Button>}
          <Button onClick={handleCreate}>
            <Plus className="mr-2" size={16} />
            Add Event
          </Button>
        </div>
      </div>

      {/* AI Event Creator */}
      {capabilities?.ai && showAICreator && (
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

      {canCheckPublished && sites.some(site => site.publishedScheduleUrl) && (
        <p className="text-xs text-muted-foreground">
          {capabilities?.timezone
            ? "Today's published bookings refresh every 5 minutes while this view is visible."
            : 'Automatic checks await club settings; manual checks are available.'}
          {' '}Source data may be cached for up to 1 minute. Checks never change QMT bookings or send notifications.
        </p>
      )}
      <OperationsCardGrid columns={2}>
        {filteredAndSortedEvents.map((event) => (
          <Card key={event.id} className="glass-card">
            <OperationsCardHeader
              title={event.title}
              badges={
                <>
                  <Badge variant="secondary">{event.eventType}</Badge>
                  <Badge>{event.status}</Badge>
                  {!!event.sharedFieldBookings?.length && <SharedFieldBadge />}
                  {event.isRecurring && <Badge variant="outline">Recurring</Badge>}
                </>
              }
              actions={currentUser && (currentUser.role === 'admin' || currentUser.role === 'mgmt') && (
                <>
                  {event.status === 'Cancelled' && (() => {
                    const eventFieldIds = event.fieldIds || []
                    const primaryField = eventFieldIds.length > 0 ? fields.find(f => f.id === eventFieldIds[0]) : null
                    const site = primaryField ? sites.find(s => s.id === primaryField.siteId) : null
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
                  {capabilities?.transport && event.eventType === 'Game' && event.gameLocation === 'away' && event.status !== 'Cancelled' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => void sendTransportRequest(event.id)}
                      title="Open transport email draft" aria-label="Open transport email draft">
                      <Bus size={18} weight="bold" />
                    </Button>
                  )}
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
                </>
              )}
            />
            <CardContent className="flex flex-1 flex-col gap-1 text-sm">
              <OperationsCardSection name="timing" className="flex items-start gap-2">
                <CalendarBlank size={14} className="mt-0.5 shrink-0" />
                <span>{event.date} • {formatEventTimeRange(event)}</span>
              </OperationsCardSection>
              <OperationsCardSection name="teams" className="text-xs text-muted-foreground">
                {event.teamIds && event.teamIds.length > 0 && (
                  <>
                    Teams: {event.teamIds.map(id => teams.find(t => t.id === id)?.name).join(', ')}
                  </>
                )}
              </OperationsCardSection>
              <OperationsCardSection name="published-booking" className="space-y-2">
                {canCheckPublished && publishedSites(event, fields, sites).map(site => (
                  <PublishedBookingCheck key={site.id} event={event} site={site} fields={fields} teams={teams}
                    state={published.results[publishedScheduleKey(site, event.date)]}
                    onCheck={() => void published.check(site, event.date)} />
                ))}
              </OperationsCardSection>
              <OperationsCardSection name="shared-field">
                <SharedFieldNotice event={event} fields={fields} sites={sites} teams={teams} />
              </OperationsCardSection>
            </CardContent>
          </Card>
        ))}
      </OperationsCardGrid>

      <Dialog open={showDialog} onOpenChange={open => {
        if (!savingRef.current) {
          setShowDialog(open)
          if (!open) setConflictReview(null)
        }
      }}>
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
            <fieldset disabled={isSaving} className="min-w-0 space-y-4">
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
                <Label htmlFor="date" style={{ color: COLORS.CHARCOAL }}>Start Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({
                    ...formData,
                    date: e.target.value,
                    endDate: !formData.endDate || formData.endDate === formData.date ? e.target.value : formData.endDate
                  })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" style={{ color: COLORS.CHARCOAL }}>End Date *</Label>
                <Input id="endDate" type="date" min={formData.date}
                  value={formData.endDate || formData.date}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required style={{ color: COLORS.CHARCOAL }} />
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

            {/* Game Location: Home/Away selection for Game events */}
            {formData.eventType === 'Game' && (
              <div className="space-y-4 p-4 rounded-lg border" style={{ borderColor: COLORS.ACCENT, backgroundColor: 'rgba(36, 139, 204, 0.05)' }}>
                <Label style={{ color: COLORS.CHARCOAL, fontWeight: 600 }}>Game Location *</Label>
                <RadioGroup
                  value={formData.gameLocation || ''}
                  onValueChange={(v) => setFormData({ 
                    ...formData, 
                    gameLocation: v as GameLocation,
                    // Clear fields if switching to away, clear away address if switching to home
                    fieldIds: v === 'away' ? [] : formData.fieldIds,
                    awayStreet: v === 'home' ? '' : formData.awayStreet,
                    awayZip: v === 'home' ? '' : formData.awayZip,
                    awayCity: v === 'home' ? '' : formData.awayCity,
                    transportRequested: v === 'home' ? false : formData.transportRequested
                  })}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="home" id="game-home" />
                    <Label htmlFor="game-home" className="flex items-center gap-2 cursor-pointer" style={{ color: COLORS.CHARCOAL }}>
                      <House size={18} weight="bold" style={{ color: COLORS.ACCENT }} />
                      Home Game
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="away" id="game-away" />
                    <Label htmlFor="game-away" className="flex items-center gap-2 cursor-pointer" style={{ color: COLORS.CHARCOAL }}>
                      <MapPin size={18} weight="bold" style={{ color: COLORS.NAVY }} />
                      Away Game
                    </Label>
                  </div>
                </RadioGroup>

                {/* Home Game: Show field selector with multi-select */}
                {formData.gameLocation === 'home' && (
                  <div className="space-y-2 pt-2">
                    <Label style={{ color: COLORS.CHARCOAL }}>
                      Field(s) * {selectedSiteId && <span className="text-xs text-muted-foreground ml-2">(Select multiple from same site)</span>}
                    </Label>
                    <div className="p-3 border rounded-md max-h-48 overflow-y-auto space-y-3">
                      {Object.entries(locationsBysite).map(([siteId, siteData]) => {
                        // If a field is already selected, only show fields from that site
                        if (selectedSiteId && siteId !== selectedSiteId) {
                          return null
                        }
                        return (
                          <div key={siteId} className="space-y-2">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {siteData.siteName}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                              {siteData.fields.map((location: any) => (
                                <div key={location.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`field-${location.id}`}
                                    checked={formData.fieldIds?.includes(location.id)}
                                    onCheckedChange={() => handleFieldToggle(location.id)}
                                  />
                                  <label htmlFor={`field-${location.id}`} className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>
                                    {location.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {selectedSiteId && formData.fieldIds && formData.fieldIds.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, fieldIds: [] })}
                        className="text-xs"
                      >
                        Clear selection (choose different site)
                      </Button>
                    )}
                  </div>
                )}

                {/* Away Game: Show address fields and transport request */}
                {formData.gameLocation === 'away' && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="awayStreet" style={{ color: COLORS.CHARCOAL }}>Street Address *</Label>
                        <Input
                          id="awayStreet"
                          value={formData.awayStreet || ''}
                          onChange={(e) => setFormData({ ...formData, awayStreet: e.target.value })}
                          placeholder="123 Stadium Road"
                          required
                          style={{ color: COLORS.CHARCOAL }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="awayZip" style={{ color: COLORS.CHARCOAL }}>ZIP Code *</Label>
                        <Input
                          id="awayZip"
                          value={formData.awayZip || ''}
                          onChange={(e) => setFormData({ ...formData, awayZip: e.target.value })}
                          placeholder="8000"
                          required
                          style={{ color: COLORS.CHARCOAL }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awayCity" style={{ color: COLORS.CHARCOAL }}>City *</Label>
                      <Input
                        id="awayCity"
                        value={formData.awayCity || ''}
                        onChange={(e) => setFormData({ ...formData, awayCity: e.target.value })}
                        placeholder="Zürich"
                        required
                        style={{ color: COLORS.CHARCOAL }}
                      />
                    </div>
                    
                    {/* Transport Request */}
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-amber-50 transition-colors"
                      style={{ 
                        borderColor: formData.transportRequested ? '#f59e0b' : '#e5e7eb',
                        backgroundColor: formData.transportRequested ? 'rgba(245, 158, 11, 0.1)' : 'transparent'
                      }}
                      onClick={() => { if (capabilities?.transport) setFormData({ ...formData, transportRequested: !formData.transportRequested }) }}
                    >
                      <div className="flex items-center gap-3">
                        <Bus size={24} weight={formData.transportRequested ? 'fill' : 'regular'} className="text-amber-600" />
                        <div>
                          <Label className="cursor-pointer font-medium" style={{ color: COLORS.CHARCOAL }}>
                            Request Transport
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {capabilities?.transport ? 'Opens a draft for the configured transport contact with team contacts in CC'
                              : 'Unavailable until a club transport contact is configured'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.transportRequested || false}
                        disabled={!capabilities?.transport}
                        onCheckedChange={(checked) => setFormData({ ...formData, transportRequested: checked })}
                        onClick={(e) => e.stopPropagation()}
                        style={{ backgroundColor: formData.transportRequested ? '#f59e0b' : undefined }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Location for non-Game events - multi-select with site grouping */}
            {formData.eventType !== 'Game' && (
              <div className="space-y-2">
                <Label style={{ color: COLORS.CHARCOAL }}>
                  Location{formData.eventType === 'Practice' && '(s)'}
                  {formData.eventType === 'Meeting' || formData.eventType === 'Other' ? ' (Room)' : ' (Field)'}
                  {selectedSiteId && <span className="text-xs text-muted-foreground ml-2">(Select from same site)</span>}
                </Label>
                <div className="p-3 border rounded-md max-h-48 overflow-y-auto space-y-3">
                  {Object.entries(locationsBysite).map(([siteId, siteData]) => {
                    // If a field is already selected, only show fields from that site
                    if (selectedSiteId && siteId !== selectedSiteId) {
                      return null
                    }
                    return (
                      <div key={siteId} className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {siteData.siteName}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                          {siteData.fields.map((location: any) => (
                            <div key={location.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`location-${location.id}`}
                                checked={formData.fieldIds?.includes(location.id)}
                                onCheckedChange={() => handleFieldToggle(location.id)}
                              />
                              <label htmlFor={`location-${location.id}`} className="text-sm cursor-pointer" style={{ color: COLORS.CHARCOAL }}>
                                {formData.eventType === 'Meeting' || formData.eventType === 'Other' 
                                  ? location.name 
                                  : location.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {selectedSiteId && formData.fieldIds && formData.fieldIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, fieldIds: [] })}
                    className="text-xs"
                  >
                    Clear selection (choose different site)
                  </Button>
                )}
              </div>
            )}

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

            {activeConflictReview && (
              <section ref={conflictRef} tabIndex={-1} role="alert" aria-labelledby="booking-conflict-heading"
                className="space-y-3 rounded-md border border-amber-500 bg-amber-50 p-4 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2">
                <h3 id="booking-conflict-heading" className="font-semibold">Location booking conflict</h3>
                <p className="text-sm">
                  Nothing has been saved. {activeConflictReview.conflicts.length}{activeConflictReview.hasMoreConflicts ? '+' : ''} overlapping
                  {' '}booking{activeConflictReview.conflicts.length === 1 ? '' : 's'} found for this {formData.isRecurring ? 'series' : 'event'}.
                </p>
                <ul className="max-h-64 space-y-3 overflow-y-auto text-sm break-words" tabIndex={0} aria-label="Overlapping bookings">
                  {activeConflictReview.conflicts.map(conflict => (
                    <li key={`${conflict.eventId}:${conflict.requestedStartTime}`} className="rounded border border-amber-200 bg-white p-3 space-y-1">
                      <p className="font-semibold">{conflict.title} <span className="font-normal">({conflict.eventType}, {conflict.status})</span></p>
                      <p>{conflict.fields.map(field => `${field.siteName} / ${field.name}`).join('; ')}</p>
                      <p>Teams: {conflict.teams.map(team => team.name).join(', ') || 'No team assigned'}</p>
                      <p>Already booked: {formatBookingInterval(conflict.startTime, conflict.endTime)}</p>
                      <p>Your occurrence: {formatBookingInterval(conflict.requestedStartTime, conflict.requestedEndTime)}</p>
                    </li>
                  ))}
                </ul>
                {activeConflictReview.hasMoreConflicts && <p className="text-sm">Showing the first 200 overlaps; additional overlaps exist.</p>}
                <p className="text-sm">
                  Change the date, time or location and save again, or choose Save anyway to share the overlapping fields
                  {' '}for {formData.isRecurring ? 'the entire series' : 'this event'}. No team will have exclusive use of the full field during overlaps. Existing bookings will not be changed.
                </p>
              </section>
            )}

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
                {isSaving ? 'Saving...' : activeConflictReview ? 'Check again' : editingEvent ? 'Save' : 'Create'}
              </Button>
              {activeConflictReview && canOverrideConflict && (
                <Button type="button" className="w-full sm:w-auto min-h-[44px]" variant="destructive"
                  onClick={() => void saveEvent(true)}>
                  Save anyway{formData.isRecurring ? ' (entire series)' : ''}
                </Button>
              )}
            </div>
            </fieldset>
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
          event={events.find(event => event.id === shareDialogEvent.id) || shareDialogEvent}
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
            const eventFieldIds = eventToDelete.fieldIds || []
            const primaryField = eventFieldIds.length > 0 ? fields.find(f => f.id === eventFieldIds[0]) : null
            const site = primaryField ? sites.find(s => s.id === primaryField.siteId) : null
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
          
          {/* Spond delete option */}
          {capabilities?.spond && eventToDelete?.spondId && (
            <div className="flex items-start gap-3 py-2 px-1">
              <Checkbox
                id="also-delete-spond"
                checked={alsoDeleteFromSpond}
                onCheckedChange={(checked) => setAlsoDeleteFromSpond(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="also-delete-spond"
                  className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                >
                  <CloudArrowUp size={16} className="text-blue-600" />
                  Also cancel in Spond
                </label>
                <p className="text-xs text-muted-foreground">
                  This event is linked to Spond. Cancel it there too so members are notified.
                </p>
              </div>
            </div>
          )}
          
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

      {/* Export Dialog */}
      <ScheduleExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        events={events}
        teams={teams}
        fields={fields}
        sites={sites}
        initialFilters={{
          teamId: filterTeam,
          eventType: filterEventType,
          startDate: filterStartDate,
          endDate: filterEndDate
        }}
      />
    </div>
  )
}
