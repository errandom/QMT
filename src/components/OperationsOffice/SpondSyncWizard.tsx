import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ArrowsClockwise, 
  Check, 
  ArrowRight,
  ArrowLeft,
  CloudArrowDown,
  CloudArrowUp,
  ArrowsLeftRight,
  CalendarBlank,
  UserCheck,
  Calendar,
  CheckCircle,
  Warning,
  Info,
  MagnifyingGlass,
  MapPin,
  Users,
  XCircle,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { getToken } from '@/lib/api'
import { COLORS } from '@/lib/constants'

interface SyncResult {
  success: boolean
  imported?: number
  exported?: number
  attendanceUpdated?: number
  eventsProcessed?: number
  error?: string
  errors?: (string | { team?: string; eventId?: number; error: string; groupId?: string; name?: string })[]
  details?: {
    eventsImported?: string[]
    eventsExported?: string[]
    attendanceSynced?: string[]
  }
  exportDiagnostic?: {
    totalInRange: number
    eligible: number
    alreadyExported: number
    noTeam: number
    teamNotLinked: number
  }
}

interface ImportPreviewEvent {
  spondId: string
  heading: string
  description: string
  eventType: string
  startTime: string
  endTime: string
  location: string | null
  spondGroupName: string | null
  spondSubgroups: string[]
  mappedTeam: { id: number; name: string } | null
  alreadyImported: boolean
  action: 'import' | 'update'
  cancelled: boolean
  attendance: {
    accepted: number
    declined: number
    unanswered: number
    waiting: number
    total: number
    estimatedAttendance: number
  }
}

interface ImportPreview {
  summary: {
    totalInSpond: number
    willImport: number
    willUpdate: number
    withTeamMapping: number
    withoutTeamMapping: number
    cancelled: number
    withAttendance: number
  }
  events: ImportPreviewEvent[]
}

interface ExportConflict {
  id: number
  title: string
  eventType: string
  startTime: string
  endTime: string
  teamName: string | null
  status: string
  spondId: string | null
  spondGroupId: string | null
  conflict: string
  message: string
}

interface ExportValidation {
  summary: {
    totalInRange: number
    readyToExport: number
    alreadyExported: number
    conflicts: number
    cannotExport: number
  }
  readyToExport: any[]
  alreadyExported: any[]
  conflicts: ExportConflict[]
  cannotExport: any[]
}

// Helper to format error items that can be strings or objects
function formatError(err: string | { team?: string; eventId?: number; error: string; groupId?: string; name?: string; rawError?: string }): string {
  if (typeof err === 'string') {
    return err
  }
  
  const parts: string[] = []
  if (err.eventId) parts.push(`Event ${err.eventId}`)
  if (err.team) parts.push(`Team: ${err.team}`)
  if (err.groupId) parts.push(`Group ID: ${err.groupId}`)
  if (err.name) parts.push(err.name)
  
  const prefix = parts.length > 0 ? `[${parts.join(' | ')}] ` : ''
  return `${prefix}${err.error || 'Unknown error'}`
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

interface SpondSyncWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export default function SpondSyncWizard({
  open,
  onOpenChange,
  onComplete,
}: SpondSyncWizardProps) {
  const [step, setStep] = useState(1)
  const totalSteps = 4
  
  // Step 1: Sync direction
  const [syncDirection, setSyncDirection] = useState<'import' | 'export' | 'both'>('import')
  
  // Step 2: What to sync
  const [syncOptions, setSyncOptions] = useState({
    events: true,
    attendance: true,
  })
  
  // Step 3: Date range options
  const [dateOptions, setDateOptions] = useState({
    daysAhead: 60,
    daysBehind: 7,
  })

  // Step 4: Preview data
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [exportValidation, setExportValidation] = useState<ExportValidation | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  
  // Export conflict handling
  const [conflictsAcknowledged, setConflictsAcknowledged] = useState(false)
  const [skipConflictedEvents, setSkipConflictedEvents] = useState(true)
  
  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1)
      setSyncDirection('import')
      setSyncOptions({ events: true, attendance: true })
      setDateOptions({ daysAhead: 60, daysBehind: 7 })
      setImportPreview(null)
      setExportValidation(null)
      setPreviewError(null)
      setConflictsAcknowledged(false)
      setSkipConflictedEvents(true)
      setSyncResult(null)
    }
  }, [open])

  // When direction changes to export, disable attendance
  useEffect(() => {
    if (syncDirection === 'export') {
      setSyncOptions(prev => ({ ...prev, attendance: false }))
    }
  }, [syncDirection])

  const fetchPreview = async () => {
    setLoadingPreview(true)
    setPreviewError(null)
    setImportPreview(null)
    setExportValidation(null)
    setConflictsAcknowledged(false)

    try {
      // Fetch import preview if importing
      if (syncDirection === 'import' || syncDirection === 'both') {
        const response = await fetch(
          `/api/spond/import-preview?daysAhead=${dateOptions.daysAhead}&daysBehind=${dateOptions.daysBehind}`,
          { headers: { 'Authorization': `Bearer ${getToken()}` } }
        )
        if (!response.ok) throw new Error('Failed to load import preview')
        const data = await response.json()
        setImportPreview(data)
      }

      // Fetch export validation if exporting
      if (syncDirection === 'export' || syncDirection === 'both') {
        const response = await fetch('/api/spond/export-validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            daysAhead: dateOptions.daysAhead,
            daysBehind: dateOptions.daysBehind,
          }),
        })
        if (!response.ok) throw new Error('Failed to load export validation')
        const data = await response.json()
        setExportValidation(data)
      }
    } catch (error) {
      setPreviewError((error as Error).message)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleNext = () => {
    if (step === 3) {
      // Moving to preview step - load preview data
      setStep(4)
      fetchPreview()
    } else if (step < totalSteps) {
      setStep(step + 1)
    } else {
      executeSync()
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return true
      case 2:
        if (syncDirection === 'export') return syncOptions.events
        return syncOptions.events || syncOptions.attendance
      case 3:
        return true
      case 4:
        // Can proceed if preview loaded and no unacknowledged conflicts
        if (loadingPreview || previewError) return false
        if (exportValidation?.conflicts && exportValidation.conflicts.length > 0 && !conflictsAcknowledged) return false
        return true
      default:
        return false
    }
  }

  const executeSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    
    try {
      const response = await fetch('/api/spond/sync-with-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          direction: syncDirection,
          syncEvents: syncOptions.events,
          syncAttendance: syncOptions.attendance,
          daysAhead: dateOptions.daysAhead,
          daysBehind: dateOptions.daysBehind,
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setSyncResult({
          success: true,
          imported: result.imported || 0,
          exported: result.exported || 0,
          attendanceUpdated: result.attendanceUpdated || 0,
          errors: result.errors,
          exportDiagnostic: result.exportDiagnostic,
        })
      } else {
        setSyncResult({
          success: false,
          error: result.error || 'Sync failed',
          errors: result.errors,
          exportDiagnostic: result.exportDiagnostic,
        })
      }
    } catch (error) {
      setSyncResult({
        success: false,
        error: 'Failed to connect to server'
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleClose = () => {
    if (syncResult?.success) {
      onComplete()
    }
    onOpenChange(false)
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1.5 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
              s === step
                ? 'bg-[#248bcc] text-white'
                : s < step
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s < step ? <Check size={14} weight="bold" /> : s}
          </div>
          {s < 4 && (
            <div
              className={`w-8 h-0.5 mx-0.5 ${
                s < step ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )

  const renderStepTitle = () => {
    switch (step) {
      case 1:
        return { title: 'Sync Direction', description: 'Choose how data should flow' }
      case 2:
        return { title: 'What to Sync', description: 'Select the data types to synchronize' }
      case 3:
        return { title: 'Date Range', description: 'Configure the sync time period' }
      case 4:
        return { title: 'Preview & Confirm', description: 'Review what will be synced' }
      default:
        return { title: '', description: '' }
    }
  }

  const renderStep1 = () => (
    <div className="space-y-4">
      <RadioGroup
        value={syncDirection}
        onValueChange={(value) => setSyncDirection(value as 'import' | 'export' | 'both')}
        className="space-y-3"
      >
        <label
          htmlFor="direction-import"
          className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            syncDirection === 'import'
              ? 'border-[#248bcc] bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <RadioGroupItem value="import" id="direction-import" className="mt-1" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CloudArrowDown size={20} className="text-blue-600" />
              <span className="font-medium text-gray-900">Import from Spond</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Pull events and attendance data from Spond into your application
            </p>
          </div>
        </label>

        <label
          htmlFor="direction-export"
          className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            syncDirection === 'export'
              ? 'border-[#248bcc] bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <RadioGroupItem value="export" id="direction-export" className="mt-1" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CloudArrowUp size={20} className="text-purple-600" />
              <span className="font-medium text-gray-900">Export to Spond</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Push your events to Spond for team members to see
            </p>
          </div>
        </label>

        <label
          htmlFor="direction-both"
          className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            syncDirection === 'both'
              ? 'border-[#248bcc] bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <RadioGroupItem value="both" id="direction-both" className="mt-1" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ArrowsLeftRight size={20} className="text-green-600" />
              <span className="font-medium text-gray-900">Two-way Sync</span>
              <Badge variant="outline" className="text-xs">Recommended</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Keep both systems in sync by importing and exporting data
            </p>
          </div>
        </label>
      </RadioGroup>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-gray-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-600">
            {syncDirection === 'export' 
              ? 'Select what data you want to export to Spond.'
              : 'Select what data you want to synchronize. You can choose to sync events, attendance, or both.'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label
          className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            syncOptions.events
              ? 'border-[#248bcc] bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Checkbox
            checked={syncOptions.events}
            onCheckedChange={(checked) => 
              setSyncOptions({ ...syncOptions, events: checked as boolean })
            }
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CalendarBlank size={20} className="text-blue-600" />
              <span className="font-medium text-gray-900">Events</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {syncDirection === 'import' 
                ? 'Import games, practices, and meetings from Spond'
                : syncDirection === 'export'
                ? 'Export your scheduled events to Spond'
                : 'Sync events between both systems'}
            </p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">Games</Badge>
              <Badge variant="secondary" className="text-xs">Practices</Badge>
              <Badge variant="secondary" className="text-xs">Meetings</Badge>
            </div>
          </div>
        </label>

        {syncDirection !== 'export' && (
          <label
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              syncOptions.attendance
                ? 'border-[#248bcc] bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Checkbox
              checked={syncOptions.attendance}
              onCheckedChange={(checked) => 
                setSyncOptions({ ...syncOptions, attendance: checked as boolean })
              }
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <UserCheck size={20} className="text-green-600" />
                <span className="font-medium text-gray-900">Attendance</span>
                <Badge variant="outline" className="text-xs text-green-600 border-green-300">Import only</Badge>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Sync player responses from Spond and store as estimated attendance
              </p>
              <div className="flex gap-2 mt-2">
                <Badge className="text-xs bg-green-100 text-green-700">Accepted</Badge>
                <Badge className="text-xs bg-red-100 text-red-700">Declined</Badge>
                <Badge className="text-xs bg-yellow-100 text-yellow-700">Pending</Badge>
              </div>
            </div>
          </label>
        )}

        {syncDirection === 'export' && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Info size={16} />
              <span>Attendance data cannot be exported to Spond - it can only be imported.</span>
            </div>
          </div>
        )}
      </div>

      {!syncOptions.events && (syncDirection === 'export' || !syncOptions.attendance) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-amber-700">
            <Warning size={16} />
            <span>Please select at least one data type to sync</span>
          </div>
        </div>
      )}
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Calendar size={20} className="text-gray-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-600">
            Configure the date range for syncing. Events within this range will be included.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="days-behind" className="text-gray-700 font-medium">
            Days in the past
          </Label>
          <Input
            id="days-behind"
            type="number"
            min={0}
            max={365}
            value={dateOptions.daysBehind}
            onChange={(e) => setDateOptions({ ...dateOptions, daysBehind: parseInt(e.target.value) || 0 })}
            className="bg-gray-50 border-gray-300"
          />
          <p className="text-xs text-gray-500">Include events from the last {dateOptions.daysBehind} days</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="days-ahead" className="text-gray-700 font-medium">
            Days in the future
          </Label>
          <Input
            id="days-ahead"
            type="number"
            min={0}
            max={365}
            value={dateOptions.daysAhead}
            onChange={(e) => setDateOptions({ ...dateOptions, daysAhead: parseInt(e.target.value) || 0 })}
            className="bg-gray-50 border-gray-300"
          />
          <p className="text-xs text-gray-500">Include events for the next {dateOptions.daysAhead} days</p>
        </div>
      </div>

      <Separator />

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm font-medium text-blue-800 mb-3">Sync Summary</p>
        <div className="space-y-2 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            {syncDirection === 'import' && <CloudArrowDown size={16} />}
            {syncDirection === 'export' && <CloudArrowUp size={16} />}
            {syncDirection === 'both' && <ArrowsLeftRight size={16} />}
            <span>
              {syncDirection === 'import' && 'Importing from Spond'}
              {syncDirection === 'export' && 'Exporting to Spond'}
              {syncDirection === 'both' && 'Two-way sync with Spond'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={16} />
            <span>
              Syncing: {[
                syncOptions.events && 'Events',
                syncDirection !== 'export' && syncOptions.attendance && 'Attendance',
              ].filter(Boolean).join(', ') || 'Nothing selected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} />
            <span>
              Date range: {dateOptions.daysBehind} days ago to {dateOptions.daysAhead} days ahead
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderImportPreview = () => {
    if (!importPreview) return null
    const { summary, events } = importPreview
    const newEvents = events.filter(e => !e.alreadyImported)
    const updateEvents = events.filter(e => e.alreadyImported)

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CloudArrowDown size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-900">Import from Spond</span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 bg-blue-50 rounded-lg text-center">
            <div className="text-lg font-semibold text-blue-700">{summary.totalInSpond}</div>
            <div className="text-[10px] text-blue-600">In Spond</div>
          </div>
          <div className="p-2 bg-green-50 rounded-lg text-center">
            <div className="text-lg font-semibold text-green-700">{summary.willImport}</div>
            <div className="text-[10px] text-green-600">New</div>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg text-center">
            <div className="text-lg font-semibold text-amber-700">{summary.willUpdate}</div>
            <div className="text-[10px] text-amber-600">Updates</div>
          </div>
          <div className="p-2 bg-purple-50 rounded-lg text-center">
            <div className="text-lg font-semibold text-purple-700">{summary.withAttendance}</div>
            <div className="text-[10px] text-purple-600">With RSVP</div>
          </div>
        </div>

        {summary.withoutTeamMapping > 0 && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <Warning size={14} />
              <span>{summary.withoutTeamMapping} event(s) have no team mapping - they will be imported without a team assignment.</span>
            </div>
          </div>
        )}

        {/* Event list */}
        <ScrollArea className="h-[250px] rounded-lg border border-gray-200">
          <div className="p-2 space-y-1.5">
            {newEvents.length > 0 && (
              <>
                <div className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded sticky top-0">
                  New Events ({newEvents.length})
                </div>
                {newEvents.map(evt => (
                  <div key={evt.spondId} className="p-2 bg-white border border-gray-100 rounded-lg hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-900 truncate">{evt.heading}</span>
                          {evt.cancelled && <Badge variant="destructive" className="text-[10px] h-4">Cancelled</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                          <span>{formatDate(evt.startTime)}</span>
                          <span>{formatTime(evt.startTime)} - {formatTime(evt.endTime)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] h-4">{evt.eventType}</Badge>
                          {evt.mappedTeam && (
                            <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                              <Users size={10} />
                              {evt.mappedTeam.name}
                            </span>
                          )}
                          {evt.location && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-0.5 truncate">
                              <MapPin size={10} />
                              {evt.location}
                            </span>
                          )}
                        </div>
                      </div>
                      {evt.attendance.total > 0 && (
                        <div className="text-right flex-shrink-0">
                          <div className="text-[10px] text-gray-400">RSVP</div>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-green-600">{evt.attendance.accepted}</span>
                            <span className="text-gray-300">/</span>
                            <span className="text-red-500">{evt.attendance.declined}</span>
                            <span className="text-gray-300">/</span>
                            <span className="text-amber-500">{evt.attendance.unanswered + evt.attendance.waiting}</span>
                          </div>
                          <div className="text-[10px] text-gray-500">Est: {evt.attendance.estimatedAttendance}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {updateEvents.length > 0 && (
              <>
                <div className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded sticky top-0 mt-2">
                  Will Update ({updateEvents.length})
                </div>
                {updateEvents.map(evt => (
                  <div key={evt.spondId} className="p-2 bg-white border border-gray-100 rounded-lg hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-900 truncate">{evt.heading}</span>
                          <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-300">Update</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                          <span>{formatDate(evt.startTime)}</span>
                          <span>{formatTime(evt.startTime)} - {formatTime(evt.endTime)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] h-4">{evt.eventType}</Badge>
                          {evt.mappedTeam && (
                            <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                              <Users size={10} />
                              {evt.mappedTeam.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {evt.attendance.total > 0 && (
                        <div className="text-right flex-shrink-0">
                          <div className="text-[10px] text-gray-400">RSVP</div>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-green-600">{evt.attendance.accepted}</span>
                            <span className="text-gray-300">/</span>
                            <span className="text-red-500">{evt.attendance.declined}</span>
                            <span className="text-gray-300">/</span>
                            <span className="text-amber-500">{evt.attendance.unanswered + evt.attendance.waiting}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {events.length === 0 && (
              <div className="text-center py-6 text-sm text-gray-500">
                No events found in Spond for the selected date range.
              </div>
            )}
          </div>
        </ScrollArea>

        {syncOptions.attendance && summary.withAttendance > 0 && (
          <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-green-700">
              <UserCheck size={14} />
              <span>Attendance from {summary.withAttendance} event(s) will be stored as estimated attendance (accepted + waiting).</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderExportPreview = () => {
    if (!exportValidation) return null
    const { summary, readyToExport, conflicts, cannotExport, alreadyExported } = exportValidation

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CloudArrowUp size={20} className="text-purple-600" />
          <span className="font-semibold text-gray-900">Export to Spond</span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 bg-blue-50 rounded-lg text-center">
            <div className="text-lg font-semibold text-blue-700">{summary.totalInRange}</div>
            <div className="text-[10px] text-blue-600">In Range</div>
          </div>
          <div className="p-2 bg-green-50 rounded-lg text-center">
            <div className="text-lg font-semibold text-green-700">{summary.readyToExport}</div>
            <div className="text-[10px] text-green-600">Ready</div>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg text-center">
            <div className="text-lg font-semibold text-gray-700">{summary.alreadyExported}</div>
            <div className="text-[10px] text-gray-500">Already Done</div>
          </div>
          {summary.conflicts > 0 ? (
            <div className="p-2 bg-red-50 rounded-lg text-center">
              <div className="text-lg font-semibold text-red-700">{summary.conflicts}</div>
              <div className="text-[10px] text-red-600">Conflicts</div>
            </div>
          ) : (
            <div className="p-2 bg-amber-50 rounded-lg text-center">
              <div className="text-lg font-semibold text-amber-700">{summary.cannotExport}</div>
              <div className="text-[10px] text-amber-600">Skipped</div>
            </div>
          )}
        </div>

        {/* Conflict warning */}
        {conflicts.length > 0 && (
          <div className="p-3 bg-red-50 border-2 border-red-300 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-red-800">
              <Warning size={18} weight="fill" />
              <span>Export Conflicts Detected</span>
            </div>
            <p className="text-xs text-red-700">
              The following event(s) were previously exported but could not be found in Spond. 
              Proceeding will create new copies in Spond.
            </p>
            <div className="space-y-1.5 mt-2">
              {conflicts.map(c => (
                <div key={c.id} className="p-2 bg-white border border-red-200 rounded text-xs">
                  <div className="flex items-center gap-2">
                    <XCircle size={14} className="text-red-500 flex-shrink-0" />
                    <span className="font-medium text-gray-900 truncate">{c.title}</span>
                  </div>
                  <p className="text-red-600 mt-0.5 ml-5">{c.message}</p>
                </div>
              ))}
            </div>
            <Separator className="bg-red-200" />
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={conflictsAcknowledged}
                onCheckedChange={(checked) => setConflictsAcknowledged(checked as boolean)}
              />
              <span className="text-xs text-red-800 font-medium">
                I understand. Proceed and re-export these events to Spond.
              </span>
            </label>
          </div>
        )}

        {/* Event list */}
        <ScrollArea className="h-[200px] rounded-lg border border-gray-200">
          <div className="p-2 space-y-1.5">
            {readyToExport.length > 0 && (
              <>
                <div className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded sticky top-0">
                  Ready to Export ({readyToExport.length})
                </div>
                {readyToExport.map((evt: any) => (
                  <div key={evt.id} className="p-2 bg-white border border-gray-100 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-1.5">
                      <ArrowSquareOut size={12} className="text-green-600 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-900 truncate">{evt.title}</span>
                      <Badge variant="secondary" className="text-[10px] h-4">{evt.eventType}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 ml-4 text-[11px] text-gray-500">
                      <span>{formatDate(evt.startTime)}</span>
                      {evt.teamName && (
                        <span className="text-blue-600 flex items-center gap-0.5">
                          <Users size={10} />
                          {evt.teamName}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {cannotExport.length > 0 && (
              <>
                <div className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded sticky top-0 mt-2">
                  Cannot Export ({cannotExport.length})
                </div>
                {cannotExport.map((evt: any) => (
                  <div key={evt.id} className="p-2 bg-white border border-gray-100 rounded-lg opacity-70">
                    <div className="flex items-center gap-1.5">
                      <Warning size={12} className="text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{evt.title}</span>
                    </div>
                    <div className="text-[10px] text-amber-600 ml-4 mt-0.5">{evt.reason}</div>
                  </div>
                ))}
              </>
            )}

            {readyToExport.length === 0 && cannotExport.length === 0 && (
              <div className="text-center py-6 text-sm text-gray-500">
                No events found for the selected date range.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  const renderStep4 = () => {
    if (loadingPreview) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <MagnifyingGlass className="animate-pulse text-blue-600" size={24} />
          </div>
          <p className="text-sm font-medium text-gray-700">Loading preview...</p>
          <p className="text-xs text-gray-500 mt-1">Connecting to Spond to fetch event data</p>
        </div>
      )
    }

    if (previewError) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <Warning className="text-red-600" size={24} weight="fill" />
          </div>
          <p className="text-sm font-medium text-red-700">Failed to load preview</p>
          <p className="text-xs text-gray-500 mt-1">{previewError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchPreview}>
            Try Again
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Import preview */}
        {(syncDirection === 'import' || syncDirection === 'both') && renderImportPreview()}
        
        {/* Separator for both mode */}
        {syncDirection === 'both' && importPreview && exportValidation && (
          <Separator />
        )}
        
        {/* Export preview */}
        {(syncDirection === 'export' || syncDirection === 'both') && renderExportPreview()}
      </div>
    )
  }

  const renderSyncProgress = () => (
    <div className="space-y-6 py-4">
      <div className="flex flex-col items-center justify-center">
        {syncing ? (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <ArrowsClockwise className="animate-spin text-blue-600" size={32} />
            </div>
            <p className="text-lg font-medium text-gray-700">Syncing data...</p>
            <p className="text-sm text-gray-500">This may take a moment</p>
          </>
        ) : syncResult ? (
          syncResult.success ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="text-green-600" size={32} weight="fill" />
              </div>
              <p className="text-lg font-medium text-green-700">Sync complete!</p>
              
              <div className="mt-4 w-full max-w-sm">
                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <div className="text-lg font-semibold text-blue-700">{syncResult.imported || 0}</div>
                    <div className="text-xs text-blue-600">Imported</div>
                  </div>
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <div className="text-lg font-semibold text-purple-700">{syncResult.exported || 0}</div>
                    <div className="text-xs text-purple-600">Exported</div>
                  </div>
                  <div className="p-2 bg-green-50 rounded-lg">
                    <div className="text-lg font-semibold text-green-700">{syncResult.attendanceUpdated || 0}</div>
                    <div className="text-xs text-green-600">Attendance</div>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  {syncResult.imported !== undefined && syncResult.imported > 0 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <CloudArrowDown size={16} className="text-blue-600 flex-shrink-0" />
                      <span>{syncResult.imported} events imported/updated from Spond</span>
                    </div>
                  )}
                  {syncResult.exported !== undefined && syncResult.exported > 0 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <CloudArrowUp size={16} className="text-purple-600 flex-shrink-0" />
                      <span>{syncResult.exported} events exported to Spond</span>
                    </div>
                  )}
                  {syncResult.attendanceUpdated !== undefined && syncResult.attendanceUpdated > 0 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <UserCheck size={16} className="text-green-600 flex-shrink-0" />
                      <span>{syncResult.attendanceUpdated} attendance records synced (stored as estimated attendance)</span>
                    </div>
                  )}
                  {syncResult.imported === 0 && syncResult.exported === 0 && syncResult.attendanceUpdated === 0 && (
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 font-medium">No changes detected</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Everything is already up to date, or no linked teams were found.
                      </p>
                    </div>
                  )}

                  {syncResult.exportDiagnostic && (syncDirection === 'export' || syncDirection === 'both') && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-700 text-xs font-medium mb-2">
                        <Info size={14} />
                        <span>Export Detail</span>
                      </div>
                      <div className="text-xs text-blue-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Events in range:</span>
                          <span className="font-medium">{syncResult.exportDiagnostic.totalInRange}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Eligible:</span>
                          <span className="font-medium">{syncResult.exportDiagnostic.eligible}</span>
                        </div>
                        {syncResult.exportDiagnostic.alreadyExported > 0 && (
                          <div className="flex justify-between text-gray-500">
                            <span>Already exported:</span>
                            <span>{syncResult.exportDiagnostic.alreadyExported}</span>
                          </div>
                        )}
                        {syncResult.exportDiagnostic.teamNotLinked > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>Team not linked:</span>
                            <span>{syncResult.exportDiagnostic.teamNotLinked}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {syncResult.errors && syncResult.errors.length > 0 && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 text-xs font-medium mb-1">
                      <Warning size={14} />
                      <span>{syncResult.errors.length} warning(s)</span>
                    </div>
                    <div className="text-xs text-amber-600 max-h-20 overflow-y-auto">
                      {syncResult.errors.slice(0, 3).map((err, i) => (
                        <div key={i} className="truncate">{formatError(err)}</div>
                      ))}
                      {syncResult.errors.length > 3 && (
                        <div className="text-amber-500">...and {syncResult.errors.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Warning className="text-red-600" size={32} weight="fill" />
              </div>
              <p className="text-lg font-medium text-red-700">Sync failed</p>
              <p className="text-sm text-gray-500 mt-1 text-center max-w-sm">
                {syncResult.error || 'An unknown error occurred'}
              </p>
              {syncResult.errors && syncResult.errors.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg max-w-sm w-full">
                  <div className="text-xs text-red-600 max-h-24 overflow-y-auto space-y-1">
                    {syncResult.errors.map((err, i) => (
                      <div key={i}>{formatError(err)}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        ) : null}
      </div>
    </div>
  )

  const stepInfo = renderStepTitle()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-gray-200 shadow-xl sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${COLORS.ACCENT}, ${COLORS.NAVY})` }}
            >
              <ArrowsClockwise size={18} weight="bold" className="text-white" />
            </div>
            {syncing || syncResult ? 'Sync Progress' : stepInfo.title}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {syncing || syncResult ? 'Synchronizing with Spond' : stepInfo.description}
          </DialogDescription>
        </DialogHeader>

        {!syncing && !syncResult && renderStepIndicator()}

        <div className="flex-1 overflow-y-auto min-h-0">
          {syncing || syncResult ? (
            renderSyncProgress()
          ) : (
            <>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0 border-t pt-4">
          {!syncing && !syncResult && (
            <>
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="border-gray-300"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back
                </Button>
              )}
              
              <div className="flex-1" />
              
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="bg-[#248bcc] hover:bg-[#1a6a9a] text-white"
              >
                {step === totalSteps ? (
                  <>
                    <ArrowsClockwise size={16} className="mr-2" />
                    Start Sync
                  </>
                ) : step === 3 ? (
                  <>
                    <MagnifyingGlass size={16} className="mr-2" />
                    Preview
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={16} className="ml-2" />
                  </>
                )}
              </Button>
            </>
          )}

          {syncResult && (
            <Button
              onClick={handleClose}
              className="bg-[#248bcc] hover:bg-[#1a6a9a] text-white ml-auto"
            >
              {syncResult.success ? 'Done' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
