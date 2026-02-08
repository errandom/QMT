import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
  MapPin,
  UsersThree,
  LinkSimple,
  CopySimple,
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

// Helper to format error items that can be strings or objects
function formatError(err: string | { team?: string; eventId?: number; error: string; groupId?: string; name?: string; rawError?: string }): string {
  if (typeof err === 'string') {
    return err
  }
  
  // Build a comprehensive error message
  const parts: string[] = []
  
  if (err.eventId) {
    parts.push(`Event ${err.eventId}`)
  }
  if (err.team) {
    parts.push(`Team: ${err.team}`)
  }
  if (err.groupId) {
    parts.push(`Group ID: ${err.groupId}`)
  }
  if (err.name) {
    parts.push(err.name)
  }
  
  const prefix = parts.length > 0 ? `[${parts.join(' | ')}] ` : ''
  return `${prefix}${err.error || 'Unknown error'}`
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
  
  // Step 4: Preview state
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<{
    summary: {
      totalEvents: number
      newEvents: number
      existingEvents: number
      potentialDuplicates: number
      withTeam: number
      withoutTeam: number
      cancelled: number
      byType: { games: number; practices: number; meetings: number; other: number }
    }
    events: Array<{
      spondId: string
      heading: string
      description: string | null
      eventType: string
      startTime: string
      endTime: string
      location: string | null
      spondGroupName: string | null
      teamName: string | null
      teamId: number | null
      alreadyExists: boolean
      existingLocalId: number | null
      fuzzyMatch: {
        localEventId: number
        localDescription: string
        localStartTime: string
        localTeamName: string | null
        localLocation: string | null
        matchScore: number
        matchReasons: string[]
      } | null
      cancelled: boolean
      attendance: { accepted: number; declined: number; unanswered: number }
      issues: string[]
    }>
  } | null>(null)
  const [exportPreview, setExportPreview] = useState<{
    summary: {
      totalEvents: number
      canExport: number
      alreadyExported: number
      noTeam: number
      teamNotLinked: number
      potentialDuplicates: number
    }
    events: Array<{
      id: number
      description: string
      eventType: string
      startTime: string
      endTime: string
      teamName: string | null
      location: string | null
      spondId: string | null
      canExport: boolean
      spondMatch: {
        spondId: string
        spondHeading: string
        spondStartTime: string
        spondLocation: string | null
        spondGroupName: string | null
        matchScore: number
        matchReasons: string[]
      } | null
      issues: string[]
    }>
  } | null>(null)

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
      setSyncResult(null)
      setImportPreview(null)
      setExportPreview(null)
      setPreviewError(null)
      setPreviewLoading(false)
    }
  }, [open])

  // When direction changes to export, disable attendance (can't export attendance)
  useEffect(() => {
    if (syncDirection === 'export') {
      setSyncOptions(prev => ({ ...prev, attendance: false }))
    }
  }, [syncDirection])

  const loadPreview = async () => {
    setPreviewLoading(true)
    setPreviewError(null)
    setImportPreview(null)
    setExportPreview(null)

    try {
      // Load import preview
      if (syncDirection === 'import' || syncDirection === 'both') {
        const response = await fetch(`/api/spond/import-preview?daysAhead=${dateOptions.daysAhead}&daysBehind=${dateOptions.daysBehind}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || `Server error (${response.status})`)
        }
        const data = await response.json()
        setImportPreview(data)
      }

      // Load export preview
      if (syncDirection === 'export' || syncDirection === 'both') {
        const response = await fetch(`/api/spond/export-preview?daysAhead=${dateOptions.daysAhead}&daysBehind=${dateOptions.daysBehind}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || `Server error (${response.status})`)
        }
        const data = await response.json()
        setExportPreview(data)
      }
    } catch (error) {
      console.error('[SpondSyncWizard] Preview error:', error)
      setPreviewError(error instanceof Error ? error.message : 'Failed to load import preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleNext = () => {
    if (step === 3) {
      // Moving to step 4 (preview) — load the preview data
      setStep(4)
      loadPreview()
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
        return true // Direction is always selected
      case 2:
        // For export, only events matter. For import/both, need events or attendance
        if (syncDirection === 'export') {
          return syncOptions.events
        }
        return syncOptions.events || syncOptions.attendance
      case 3:
        return true
      case 4:
        // Can proceed if preview loaded successfully (even if 0 events)
        return !previewLoading && !previewError
      default:
        return false
    }
  }

  const executeSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    
    console.log('[SpondSyncWizard] Starting sync with settings:', {
      direction: syncDirection,
      syncEvents: syncOptions.events,
      syncAttendance: syncOptions.attendance,
      daysAhead: dateOptions.daysAhead,
      daysBehind: dateOptions.daysBehind,
    })
    
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

      console.log('[SpondSyncWizard] API response status:', response.status)
      const result = await response.json()
      console.log('[SpondSyncWizard] Sync result:', result)
      
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
      console.error('[SpondSyncWizard] Sync error:', error)
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
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              s === step
                ? 'bg-[#248bcc] text-white'
                : s < step
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s < step ? <Check size={16} weight="bold" /> : s}
          </div>
          {s < 4 && (
            <div
              className={`w-12 h-0.5 mx-1 ${
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
        return { title: 'Preview', description: 'Review what will be synced' }
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

        {/* Only show attendance option for import or both directions */}
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
                Sync player responses (accepted, declined, pending) from Spond events
              </p>
              <div className="flex gap-2 mt-2">
                <Badge className="text-xs bg-green-100 text-green-700">Accepted</Badge>
                <Badge className="text-xs bg-red-100 text-red-700">Declined</Badge>
                <Badge className="text-xs bg-yellow-100 text-yellow-700">Pending</Badge>
              </div>
            </div>
          </label>
        )}

        {/* Show info when export only */}
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

      {/* Summary */}
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

  const renderStep4 = () => {
    if (previewLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <ArrowsClockwise className="animate-spin text-blue-600" size={32} />
          </div>
          <p className="text-lg font-medium text-gray-700">Loading preview...</p>
          <p className="text-sm text-gray-500">Fetching data from Spond</p>
        </div>
      )
    }

    if (previewError) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <Warning className="text-red-600" size={32} weight="fill" />
          </div>
          <p className="text-lg font-medium text-red-700">Failed to load preview</p>
          <p className="text-sm text-gray-500 mt-1 text-center max-w-sm">{previewError}</p>
          <Button
            variant="outline"
            onClick={loadPreview}
            className="mt-4 border-gray-300"
          >
            <ArrowsClockwise size={16} className="mr-2" />
            Try Again
          </Button>
        </div>
      )
    }

    // Helper to render a confidence badge based on match score
    const renderMatchBadge = (score: number) => {
      if (score >= 80) return <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50 flex-shrink-0">High Match ({score}%)</Badge>
      if (score >= 60) return <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50 flex-shrink-0">Likely Match ({score}%)</Badge>
      return <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50 flex-shrink-0">Possible ({score}%)</Badge>
    }

    const renderMatchReasons = (reasons: string[]) => (
      <div className="flex flex-wrap gap-1 mt-1">
        {reasons.map((r, i) => (
          <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
            {r.toLowerCase().includes('time') && <CalendarBlank size={10} />}
            {r.toLowerCase().includes('team') && <UsersThree size={10} />}
            {r.toLowerCase().includes('location') && <MapPin size={10} />}
            {r}
          </span>
        ))}
      </div>
    )

    return (
      <div className="space-y-4">
        {/* Import Preview */}
        {importPreview && (syncDirection === 'import' || syncDirection === 'both') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <CloudArrowDown size={18} className="text-blue-600" />
              <span>Import Preview</span>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-2">
              <div className="p-2 bg-blue-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-blue-700">{importPreview.summary.totalEvents}</div>
                <div className="text-xs text-blue-600">Total</div>
              </div>
              <div className="p-2 bg-green-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-green-700">{importPreview.summary.newEvents}</div>
                <div className="text-xs text-green-600">New</div>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-amber-700">{importPreview.summary.existingEvents}</div>
                <div className="text-xs text-amber-600">Updates</div>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-orange-700">{importPreview.summary.potentialDuplicates}</div>
                <div className="text-xs text-orange-600">Duplicates?</div>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-purple-700">{importPreview.summary.withTeam}</div>
                <div className="text-xs text-purple-600">With Team</div>
              </div>
            </div>

            {/* Event type breakdown */}
            <div className="flex flex-wrap gap-2">
              {importPreview.summary.byType.games > 0 && (
                <Badge variant="secondary" className="text-xs">🏈 {importPreview.summary.byType.games} Games</Badge>
              )}
              {importPreview.summary.byType.practices > 0 && (
                <Badge variant="secondary" className="text-xs">🏃 {importPreview.summary.byType.practices} Practices</Badge>
              )}
              {importPreview.summary.byType.meetings > 0 && (
                <Badge variant="secondary" className="text-xs">📋 {importPreview.summary.byType.meetings} Meetings</Badge>
              )}
              {importPreview.summary.byType.other > 0 && (
                <Badge variant="secondary" className="text-xs">📌 {importPreview.summary.byType.other} Other</Badge>
              )}
            </div>

            {/* Duplicate warning */}
            {importPreview.summary.potentialDuplicates > 0 && (
              <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2 text-xs text-orange-800">
                  <CopySimple size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{importPreview.summary.potentialDuplicates} potential duplicate(s) detected</span>
                    <span className="text-orange-600 block mt-0.5">
                      Fuzzy matching found local events with similar team, time, or location. These may already exist in your system under different names. Review the matches below.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* No-team warning */}
            {importPreview.summary.withoutTeam > 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <Warning size={14} />
                  <span>{importPreview.summary.withoutTeam} event(s) have no linked team — they will still be imported but won't appear under a team.</span>
                </div>
              </div>
            )}

            {/* Event list */}
            {importPreview.events.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {importPreview.events.map((evt, idx) => (
                    <div
                      key={evt.spondId}
                      className={`px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 ${
                        evt.fuzzyMatch ? 'bg-orange-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } ${evt.cancelled ? 'opacity-50' : ''}`}
                    >
                      {/* Event row */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 truncate">{evt.heading}</span>
                            {evt.alreadyExists ? (
                              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50 flex-shrink-0">Update</Badge>
                            ) : evt.fuzzyMatch ? (
                              renderMatchBadge(evt.fuzzyMatch.matchScore)
                            ) : (
                              <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50 flex-shrink-0">New</Badge>
                            )}
                            {evt.cancelled && (
                              <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50 flex-shrink-0">Cancelled</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <CalendarBlank size={12} />
                              {new Date(evt.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' '}
                              {new Date(evt.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <Badge variant="secondary" className="text-xs py-0">{evt.eventType}</Badge>
                            {evt.teamName && (
                              <span className="flex items-center gap-1">
                                <UsersThree size={12} />
                                {evt.teamName}
                              </span>
                            )}
                            {evt.location && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin size={12} />
                                {evt.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Fuzzy match mapping row */}
                      {evt.fuzzyMatch && (
                        <div className="mt-2 ml-2 pl-3 border-l-2 border-orange-300">
                          <div className="flex items-center gap-1.5 text-xs text-orange-700 mb-1">
                            <LinkSimple size={12} weight="bold" />
                            <span className="font-medium">Possible match with existing local event:</span>
                          </div>
                          <div className="bg-white/80 rounded p-2 text-xs">
                            <div className="font-medium text-gray-800">{evt.fuzzyMatch.localDescription}</div>
                            <div className="flex items-center gap-3 mt-0.5 text-gray-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <CalendarBlank size={10} />
                                {new Date(evt.fuzzyMatch.localStartTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                {' '}
                                {new Date(evt.fuzzyMatch.localStartTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {evt.fuzzyMatch.localTeamName && (
                                <span className="flex items-center gap-1">
                                  <UsersThree size={10} />
                                  {evt.fuzzyMatch.localTeamName}
                                </span>
                              )}
                              {evt.fuzzyMatch.localLocation && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={10} />
                                  {evt.fuzzyMatch.localLocation}
                                </span>
                              )}
                            </div>
                            {renderMatchReasons(evt.fuzzyMatch.matchReasons)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-600 font-medium">No events found</p>
                <p className="text-xs text-gray-500 mt-1">Try adjusting the date range</p>
              </div>
            )}
          </div>
        )}

        {/* Export Preview */}
        {exportPreview && (syncDirection === 'export' || syncDirection === 'both') && (
          <div className="space-y-3">
            {syncDirection === 'both' && <Separator />}
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <CloudArrowUp size={18} className="text-purple-600" />
              <span>Export Preview</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="p-2 bg-blue-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-blue-700">{exportPreview.summary.totalEvents}</div>
                <div className="text-xs text-blue-600">In Range</div>
              </div>
              <div className="p-2 bg-green-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-green-700">{exportPreview.summary.canExport}</div>
                <div className="text-xs text-green-600">Can Export</div>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-gray-700">{exportPreview.summary.alreadyExported}</div>
                <div className="text-xs text-gray-600">Exported</div>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-orange-700">{exportPreview.summary.potentialDuplicates}</div>
                <div className="text-xs text-orange-600">Duplicates?</div>
              </div>
            </div>

            {/* Duplicate warning for export */}
            {exportPreview.summary.potentialDuplicates > 0 && (
              <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2 text-xs text-orange-800">
                  <CopySimple size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{exportPreview.summary.potentialDuplicates} potential duplicate(s) on Spond</span>
                    <span className="text-orange-600 block mt-0.5">
                      Fuzzy matching found Spond events with similar team, time, or location. Exporting may create duplicates. Review the matches below.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {(exportPreview.summary.noTeam > 0 || exportPreview.summary.teamNotLinked > 0) && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <Warning size={14} />
                  <span>
                    {exportPreview.summary.noTeam > 0 && `${exportPreview.summary.noTeam} event(s) have no team. `}
                    {exportPreview.summary.teamNotLinked > 0 && `${exportPreview.summary.teamNotLinked} event(s) have teams not linked to Spond.`}
                  </span>
                </div>
              </div>
            )}

            {/* Export event list */}
            {exportPreview.events.filter(e => e.canExport).length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {exportPreview.events.filter(e => e.canExport).map((evt, idx) => (
                    <div
                      key={evt.id}
                      className={`px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 ${
                        evt.spondMatch ? 'bg-orange-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 truncate">{evt.description}</span>
                            {evt.spondMatch ? (
                              renderMatchBadge(evt.spondMatch.matchScore)
                            ) : (
                              <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50 flex-shrink-0">New to Spond</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <CalendarBlank size={12} />
                              {new Date(evt.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' '}
                              {new Date(evt.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <Badge variant="secondary" className="text-xs py-0">{evt.eventType}</Badge>
                            {evt.teamName && (
                              <span className="flex items-center gap-1">
                                <UsersThree size={12} />
                                {evt.teamName}
                              </span>
                            )}
                            {evt.location && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin size={12} />
                                {evt.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Spond match mapping row */}
                      {evt.spondMatch && (
                        <div className="mt-2 ml-2 pl-3 border-l-2 border-orange-300">
                          <div className="flex items-center gap-1.5 text-xs text-orange-700 mb-1">
                            <LinkSimple size={12} weight="bold" />
                            <span className="font-medium">Possible match on Spond:</span>
                          </div>
                          <div className="bg-white/80 rounded p-2 text-xs">
                            <div className="font-medium text-gray-800">{evt.spondMatch.spondHeading}</div>
                            <div className="flex items-center gap-3 mt-0.5 text-gray-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <CalendarBlank size={10} />
                                {new Date(evt.spondMatch.spondStartTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                {' '}
                                {new Date(evt.spondMatch.spondStartTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {evt.spondMatch.spondGroupName && (
                                <span className="flex items-center gap-1">
                                  <UsersThree size={10} />
                                  {evt.spondMatch.spondGroupName}
                                </span>
                              )}
                              {evt.spondMatch.spondLocation && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={10} />
                                  {evt.spondMatch.spondLocation}
                                </span>
                              )}
                            </div>
                            {renderMatchReasons(evt.spondMatch.matchReasons)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Duplicate summary legend */}
        {((importPreview?.summary.potentialDuplicates ?? 0) > 0 || (exportPreview?.summary.potentialDuplicates ?? 0) > 0) && (
          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-gray-700">How duplicate detection works:</span>
                <span className="block mt-0.5">Events are compared using team name, time (within 30 minutes), and location similarity. A score of 80%+ indicates a very likely duplicate. Proceeding will still sync all events — review flagged items to decide if the sync is appropriate.</span>
              </div>
            </div>
          </div>
        )}

        {/* No events to sync at all */}
        {importPreview?.summary.totalEvents === 0 && (!exportPreview || exportPreview.summary.canExport === 0) && (
          <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 font-medium">Nothing to sync</p>
            <p className="text-xs text-gray-500 mt-1">No events found in the selected date range. Try expanding the range.</p>
          </div>
        )}
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
              
              {/* Summary stats */}
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
                
                {/* Detailed breakdown */}
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
                      <span>{syncResult.attendanceUpdated} attendance records synced</span>
                    </div>
                  )}
                  {syncResult.imported === 0 && syncResult.exported === 0 && syncResult.attendanceUpdated === 0 && (
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 font-medium">No changes detected</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Everything is already up to date, or no linked teams were found.
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Make sure you have teams linked to Spond groups.
                      </p>
                    </div>
                  )}
                  
                  {/* Export diagnostic info - helps user understand why events weren't exported */}
                  {syncDirection === 'export' && syncResult.exportDiagnostic && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-700 text-xs font-medium mb-2">
                        <Info size={14} />
                        <span>Export Diagnostic</span>
                      </div>
                      <div className="text-xs text-blue-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Events in date range:</span>
                          <span className="font-medium">{syncResult.exportDiagnostic.totalInRange}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Eligible for export:</span>
                          <span className="font-medium">{syncResult.exportDiagnostic.eligible}</span>
                        </div>
                        {syncResult.exportDiagnostic.alreadyExported > 0 && (
                          <div className="flex justify-between text-gray-500">
                            <span>Already exported:</span>
                            <span>{syncResult.exportDiagnostic.alreadyExported}</span>
                          </div>
                        )}
                        {syncResult.exportDiagnostic.noTeam > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>No team assigned:</span>
                            <span>{syncResult.exportDiagnostic.noTeam}</span>
                          </div>
                        )}
                        {syncResult.exportDiagnostic.teamNotLinked > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>Team not linked to Spond:</span>
                            <span>{syncResult.exportDiagnostic.teamNotLinked}</span>
                          </div>
                        )}
                      </div>
                      {(syncResult.exportDiagnostic.noTeam > 0 || syncResult.exportDiagnostic.teamNotLinked > 0) && (
                        <p className="text-xs text-blue-600 mt-2 pt-2 border-t border-blue-200">
                          💡 To export events, assign them to teams and link those teams to Spond groups in the Integration settings.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Show any errors/warnings */}
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
              {/* Show export diagnostic even on failure to help user understand */}
              {syncResult.exportDiagnostic && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-sm w-full">
                  <div className="flex items-center gap-2 text-blue-700 text-xs font-medium mb-2">
                    <Info size={14} />
                    <span>Export Diagnostic</span>
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
                    {syncResult.exportDiagnostic.teamNotLinked > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>Team not linked:</span>
                        <span>{syncResult.exportDiagnostic.teamNotLinked}</span>
                      </div>
                    )}
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
      <DialogContent className="bg-white border border-gray-200 shadow-xl sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
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
