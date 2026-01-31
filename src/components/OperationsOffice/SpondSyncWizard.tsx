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
  errors?: string[]
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
  const totalSteps = 3
  
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
    }
  }, [open])

  // When direction changes to export, disable attendance (can't export attendance)
  useEffect(() => {
    if (syncDirection === 'export') {
      setSyncOptions(prev => ({ ...prev, attendance: false }))
    }
  }, [syncDirection])

  const handleNext = () => {
    if (step < totalSteps) {
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
      {[1, 2, 3].map((s) => (
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
          {s < 3 && (
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
                        <div key={i} className="truncate">{err}</div>
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
                      <div key={i}>{err}</div>
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
