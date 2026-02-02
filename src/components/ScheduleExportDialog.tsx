import { useState, useMemo } from 'react'
import { Event, Team, Field, Site, EventType } from '@/lib/types'
import { exportToExcel, filterEventsForExport, ExportFilters } from '@/lib/exportUtils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { FileXls, FunnelSimple, CalendarBlank, Users, Tag, Warning, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { COLORS } from '@/lib/constants'

interface ScheduleExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  events: Event[]
  teams: Team[]
  fields: Field[]
  sites: Site[]
  // Pre-populate from current filter state
  initialFilters?: {
    teamId?: string
    eventType?: string
    startDate?: string
    endDate?: string
  }
}

const EVENT_TYPES: EventType[] = ['Game', 'Practice', 'Meeting', 'Other']

export default function ScheduleExportDialog({
  open,
  onOpenChange,
  events,
  teams,
  fields,
  sites,
  initialFilters
}: ScheduleExportDialogProps) {
  // Team selection
  const [selectedTeams, setSelectedTeams] = useState<string[]>(
    initialFilters?.teamId && initialFilters.teamId !== 'all' 
      ? [initialFilters.teamId] 
      : []
  )

  // Event type selection
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(
    initialFilters?.eventType && initialFilters.eventType !== 'all'
      ? [initialFilters.eventType]
      : []
  )

  // Date range
  const [startDate, setStartDate] = useState(initialFilters?.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters?.endDate || '')

  // Get active teams only
  const activeTeams = useMemo(() => teams.filter(t => t.isActive), [teams])

  // Calculate preview of filtered events
  const exportFilters: ExportFilters = useMemo(() => ({
    teamIds: selectedTeams,
    eventTypes: selectedEventTypes,
    startDate,
    endDate
  }), [selectedTeams, selectedEventTypes, startDate, endDate])

  const filteredEvents = useMemo(() => 
    filterEventsForExport(events, exportFilters),
    [events, exportFilters]
  )

  // Toggle team selection
  const handleTeamToggle = (teamId: string) => {
    setSelectedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    )
  }

  // Toggle event type selection
  const handleEventTypeToggle = (eventType: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(eventType)
        ? prev.filter(et => et !== eventType)
        : [...prev, eventType]
    )
  }

  // Select/deselect all teams
  const handleSelectAllTeams = () => {
    if (selectedTeams.length === activeTeams.length) {
      setSelectedTeams([])
    } else {
      setSelectedTeams(activeTeams.map(t => t.id))
    }
  }

  // Select/deselect all event types
  const handleSelectAllEventTypes = () => {
    if (selectedEventTypes.length === EVENT_TYPES.length) {
      setSelectedEventTypes([])
    } else {
      setSelectedEventTypes([...EVENT_TYPES])
    }
  }

  // Quick date range presets
  const setDatePreset = (preset: 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth' | 'next3Months') => {
    const today = new Date()
    let start: Date
    let end: Date

    switch (preset) {
      case 'thisWeek':
        start = new Date(today)
        start.setDate(today.getDate() - today.getDay())
        end = new Date(start)
        end.setDate(start.getDate() + 6)
        break
      case 'nextWeek':
        start = new Date(today)
        start.setDate(today.getDate() - today.getDay() + 7)
        end = new Date(start)
        end.setDate(start.getDate() + 6)
        break
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        break
      case 'nextMonth':
        start = new Date(today.getFullYear(), today.getMonth() + 1, 1)
        end = new Date(today.getFullYear(), today.getMonth() + 2, 0)
        break
      case 'next3Months':
        start = new Date(today)
        end = new Date(today)
        end.setMonth(today.getMonth() + 3)
        break
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedTeams([])
    setSelectedEventTypes([])
    setStartDate('')
    setEndDate('')
  }

  // Handle export
  const handleExport = () => {
    try {
      exportToExcel(events, { events, teams, fields, sites }, exportFilters)
      toast.success(`Exported ${filteredEvents.length} events to Excel`)
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to export schedule')
    }
  }

  // Reset filters when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Reset to initial filters when opening
      setSelectedTeams(
        initialFilters?.teamId && initialFilters.teamId !== 'all' 
          ? [initialFilters.teamId] 
          : []
      )
      setSelectedEventTypes(
        initialFilters?.eventType && initialFilters.eventType !== 'all'
          ? [initialFilters.eventType]
          : []
      )
      setStartDate(initialFilters?.startDate || '')
      setEndDate(initialFilters?.endDate || '')
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileXls size={24} style={{ color: COLORS.NAVY }} weight="duotone" />
            Export Schedule to Excel
          </DialogTitle>
          <DialogDescription>
            Configure filters to export events matching your criteria. Leave filters empty to include all events.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {/* Time Frame Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarBlank size={18} style={{ color: COLORS.NAVY }} weight="duotone" />
                  <Label className="text-sm font-medium">Time Frame</Label>
                </div>
                
                {/* Date range inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="exportStartDate" className="text-xs text-muted-foreground">From Date</Label>
                    <Input
                      id="exportStartDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exportEndDate" className="text-xs text-muted-foreground">To Date</Label>
                    <Input
                      id="exportEndDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Quick presets */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDatePreset('thisWeek')}>
                    This Week
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDatePreset('nextWeek')}>
                    Next Week
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDatePreset('thisMonth')}>
                    This Month
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDatePreset('nextMonth')}>
                    Next Month
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDatePreset('next3Months')}>
                    Next 3 Months
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Teams Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={18} style={{ color: COLORS.NAVY }} weight="duotone" />
                    <Label className="text-sm font-medium">Teams</Label>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSelectAllTeams}
                    className="text-xs"
                  >
                    {selectedTeams.length === activeTeams.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground mb-2">
                  {selectedTeams.length === 0 
                    ? 'All teams included (no filter)'
                    : `${selectedTeams.length} team${selectedTeams.length !== 1 ? 's' : ''} selected`}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {activeTeams.map(team => (
                    <div
                      key={team.id}
                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleTeamToggle(team.id)}
                    >
                      <Checkbox
                        id={`team-${team.id}`}
                        checked={selectedTeams.includes(team.id)}
                        onCheckedChange={() => handleTeamToggle(team.id)}
                      />
                      <label
                        htmlFor={`team-${team.id}`}
                        className="text-sm cursor-pointer flex-1 truncate"
                      >
                        {team.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Event Types Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag size={18} style={{ color: COLORS.NAVY }} weight="duotone" />
                    <Label className="text-sm font-medium">Event Types</Label>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSelectAllEventTypes}
                    className="text-xs"
                  >
                    {selectedEventTypes.length === EVENT_TYPES.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground mb-2">
                  {selectedEventTypes.length === 0 
                    ? 'All event types included (no filter)'
                    : `${selectedEventTypes.length} type${selectedEventTypes.length !== 1 ? 's' : ''} selected`}
                </div>

                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map(eventType => (
                    <div
                      key={eventType}
                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer border"
                      onClick={() => handleEventTypeToggle(eventType)}
                    >
                      <Checkbox
                        id={`type-${eventType}`}
                        checked={selectedEventTypes.includes(eventType)}
                        onCheckedChange={() => handleEventTypeToggle(eventType)}
                      />
                      <label
                        htmlFor={`type-${eventType}`}
                        className="text-sm cursor-pointer"
                      >
                        {eventType}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <Separator className="my-4" />

        {/* Preview Summary */}
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FunnelSimple size={20} style={{ color: COLORS.NAVY }} weight="duotone" />
              <div>
                <p className="text-sm font-medium">Export Preview</p>
                <p className="text-xs text-muted-foreground">
                  {filteredEvents.length} of {events.length} events match your filters
                </p>
              </div>
            </div>
            <div>
              {filteredEvents.length > 0 ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle size={14} className="mr-1" weight="fill" />
                  Ready to Export
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <Warning size={14} className="mr-1" weight="fill" />
                  No Events
                </Badge>
              )}
            </div>
          </div>

          {/* Quick stats */}
          {filteredEvents.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-background rounded p-2 text-center">
                <div className="font-semibold text-base">{filteredEvents.filter(e => e.eventType === 'Game').length}</div>
                <div className="text-muted-foreground">Games</div>
              </div>
              <div className="bg-background rounded p-2 text-center">
                <div className="font-semibold text-base">{filteredEvents.filter(e => e.eventType === 'Practice').length}</div>
                <div className="text-muted-foreground">Practices</div>
              </div>
              <div className="bg-background rounded p-2 text-center">
                <div className="font-semibold text-base">{filteredEvents.filter(e => e.eventType === 'Meeting').length}</div>
                <div className="text-muted-foreground">Meetings</div>
              </div>
              <div className="bg-background rounded p-2 text-center">
                <div className="font-semibold text-base">{filteredEvents.filter(e => e.eventType === 'Other').length}</div>
                <div className="text-muted-foreground">Other</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClearFilters}>
            Clear Filters
          </Button>
          <Button 
            onClick={handleExport}
            disabled={filteredEvents.length === 0}
            style={{ backgroundColor: COLORS.NAVY }}
          >
            <FileXls size={16} className="mr-2" weight="duotone" />
            Export {filteredEvents.length} Events
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
