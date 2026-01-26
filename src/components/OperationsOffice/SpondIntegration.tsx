import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ArrowsClockwise, 
  Check, 
  X, 
  Lightning, 
  CloudArrowDown, 
  CloudArrowUp,
  Link as LinkIcon,
  LinkBreak,
  Users,
  CalendarBlank,
  Gear,
  Warning,
  CheckCircle,
  Circle,
  UserCheck,
  UserMinus,
  UserPlus,
  Question,
  Download,
  Upload,
  Sliders,
  ArrowRight,
  ArrowLeft,
  ArrowsLeftRight,
  Plus
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { api, getToken } from '@/lib/api'
import { COLORS } from '@/lib/constants'
import SpondSetupWizard from './SpondSetupWizard'
import SpondSyncWizard from './SpondSyncWizard'

interface SpondStatus {
  configured: boolean
  connected: boolean
  lastSync: string | null
  syncedGroups: number
  syncedEvents: number
  attendanceLastSync?: string | null
}

interface SpondGroup {
  id: string
  name: string
  parentGroup?: string | null
  activity?: string
  memberCount: number
  linkedTeam: { id: number; name: string } | null
  isSubgroup?: boolean
}

interface ImportableGroup {
  id: string
  name: string
  parentGroup: string | null
  isSubgroup: boolean
  memberCount: number
  activity?: string
}

interface SyncSettings {
  id?: number
  team_id: number
  team_name?: string
  spond_group_id: string
  spond_group_name?: string
  spond_parent_group_name?: string
  is_subgroup: boolean
  sync_events_import: boolean
  sync_events_export: boolean
  sync_attendance_import: boolean
  sync_event_title: boolean
  sync_event_description: boolean
  sync_event_time: boolean
  sync_event_location: boolean
  sync_event_type: boolean
  is_active: boolean
  last_import_sync?: string
  last_export_sync?: string
  last_attendance_sync?: string
}

interface Team {
  id: number
  name: string
  sport: string
  spond_group_id?: string
}

export default function SpondIntegration() {
  const [status, setStatus] = useState<SpondStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncingAttendance, setSyncingAttendance] = useState(false)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [showSyncWizard, setShowSyncWizard] = useState(false)
  const [showMappingDialog, setShowMappingDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showSyncSettingsDialog, setShowSyncSettingsDialog] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    autoSync: false,
    syncIntervalMinutes: 60
  })

  const [spondGroups, setSpondGroups] = useState<SpondGroup[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  
  // New state for import and sync settings
  const [importableGroups, setImportableGroups] = useState<ImportableGroup[]>([])
  const [loadingImportable, setLoadingImportable] = useState(false)
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set())
  const [importSport, setImportSport] = useState('Tackle Football')
  const [importSettings, setImportSettings] = useState({
    syncEventsImport: true,
    syncEventsExport: false,
    syncAttendanceImport: true
  })
  const [importing, setImporting] = useState(false)
  
  const [syncSettings, setSyncSettings] = useState<SyncSettings[]>([])
  const [loadingSyncSettings, setLoadingSyncSettings] = useState(false)
  const [editingSyncSettings, setEditingSyncSettings] = useState<SyncSettings | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/spond/status', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('[Spond] Error fetching status:', error)
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    if (!credentials.username || !credentials.password) {
      toast.error('Please enter your Spond credentials')
      return
    }

    setTestingConnection(true)
    try {
      const response = await fetch('/api/spond/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message || 'Connection test failed')
      }
    } catch (error) {
      toast.error('Failed to test connection')
    } finally {
      setTestingConnection(false)
    }
  }

  const saveConfiguration = async () => {
    if (!credentials.username || !credentials.password) {
      toast.error('Please enter your Spond credentials')
      return
    }

    try {
      const response = await fetch('/api/spond/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(credentials)
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Spond configured successfully')
        setShowConfigDialog(false)
        fetchStatus()
      } else {
        toast.error(result.error || 'Configuration failed')
      }
    } catch (error) {
      toast.error('Failed to save configuration')
    }
  }

  const removeConfiguration = async () => {
    if (!confirm('Are you sure you want to remove Spond integration?')) {
      return
    }

    try {
      const response = await fetch('/api/spond/configure', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      })

      if (response.ok) {
        toast.success('Spond configuration removed')
        setStatus({
          configured: false,
          connected: false,
          lastSync: null,
          syncedGroups: 0,
          syncedEvents: 0
        })
      } else {
        toast.error('Failed to remove configuration')
      }
    } catch (error) {
      toast.error('Failed to remove configuration')
    }
  }

  const triggerSync = async (type: 'full' | 'events' | 'groups') => {
    setSyncing(true)
    try {
      const endpoint = type === 'full' ? '/api/spond/sync' : `/api/spond/sync/${type}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({})
      })

      const result = await response.json()
      if (result.success || result.imported !== undefined) {
        const imported = result.imported || result.events?.imported || 0
        const updated = result.updated || result.events?.updated || 0
        toast.success(`Sync complete: ${imported} imported, ${updated} updated`)
        fetchStatus()
      } else {
        toast.error(result.error || 'Sync failed')
      }
    } catch (error) {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const fetchSpondGroups = async () => {
    setLoadingGroups(true)
    try {
      const [groupsResponse, teamsResponse] = await Promise.all([
        fetch('/api/spond/groups', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch('/api/teams', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
      ])

      if (groupsResponse.ok) {
        const groups = await groupsResponse.json()
        setSpondGroups(groups)
      }

      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json()
        setTeams(teamsData)
      }
    } catch (error) {
      toast.error('Failed to fetch groups')
    } finally {
      setLoadingGroups(false)
    }
  }

  const linkTeam = async (teamId: number, spondGroupId: string) => {
    try {
      const response = await fetch('/api/spond/link/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ teamId, spondGroupId })
      })

      if (response.ok) {
        toast.success('Team linked successfully')
        fetchSpondGroups()
      } else {
        toast.error('Failed to link team')
      }
    } catch (error) {
      toast.error('Failed to link team')
    }
  }

  const unlinkTeam = async (teamId: number) => {
    try {
      const response = await fetch(`/api/spond/link/team/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      })

      if (response.ok) {
        toast.success('Team unlinked')
        fetchSpondGroups()
      } else {
        toast.error('Failed to unlink team')
      }
    } catch (error) {
      toast.error('Failed to unlink team')
    }
  }

  const openMappingDialog = () => {
    fetchSpondGroups()
    setShowMappingDialog(true)
  }

  const syncAttendance = async () => {
    setSyncingAttendance(true)
    try {
      const response = await fetch('/api/spond/sync/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          onlyFutureEvents: true,
          daysAhead: 30,
          daysBehind: 7
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`Attendance synced for ${result.eventsUpdated} events`)
        fetchStatus()
      } else {
        toast.error(result.error || 'Attendance sync failed')
      }
    } catch (error) {
      toast.error('Failed to sync attendance')
    } finally {
      setSyncingAttendance(false)
    }
  }

  // Fetch groups available for import
  const fetchImportableGroups = async () => {
    setLoadingImportable(true)
    try {
      const response = await fetch('/api/spond/groups-for-import', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      if (response.ok) {
        const groups = await response.json()
        setImportableGroups(groups)
      } else {
        toast.error('Failed to fetch groups')
      }
    } catch (error) {
      toast.error('Failed to fetch groups')
    } finally {
      setLoadingImportable(false)
    }
  }

  // Open import dialog
  const openImportDialog = () => {
    fetchImportableGroups()
    setSelectedForImport(new Set())
    setShowImportDialog(true)
  }

  // Toggle group selection for import
  const toggleImportSelection = (groupId: string) => {
    const newSet = new Set(selectedForImport)
    if (newSet.has(groupId)) {
      newSet.delete(groupId)
    } else {
      newSet.add(groupId)
    }
    setSelectedForImport(newSet)
  }

  // Import selected teams
  const importSelectedTeams = async () => {
    if (selectedForImport.size === 0) {
      toast.error('Please select at least one team to import')
      return
    }

    setImporting(true)
    try {
      const groupsToImport = importableGroups.filter(g => selectedForImport.has(g.id))
      const response = await fetch('/api/spond/import-teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          groups: groupsToImport,
          sport: importSport,
          ...importSettings
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`Imported ${result.imported} teams`)
        setShowImportDialog(false)
        fetchStatus()
      } else {
        toast.error(result.error || 'Import failed')
      }
    } catch (error) {
      toast.error('Failed to import teams')
    } finally {
      setImporting(false)
    }
  }

  // Fetch sync settings
  const fetchSyncSettings = async () => {
    setLoadingSyncSettings(true)
    try {
      const response = await fetch('/api/spond/sync-settings', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      if (response.ok) {
        const settings = await response.json()
        setSyncSettings(settings)
      }
    } catch (error) {
      toast.error('Failed to fetch sync settings')
    } finally {
      setLoadingSyncSettings(false)
    }
  }

  // Open sync settings dialog
  const openSyncSettingsDialog = () => {
    fetchSyncSettings()
    setEditingSyncSettings(null)
    setShowSyncSettingsDialog(true)
  }

  // Save sync settings
  const saveSyncSettings = async (settings: SyncSettings) => {
    try {
      const response = await fetch('/api/spond/sync-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          teamId: settings.team_id,
          spondGroupId: settings.spond_group_id,
          spondGroupName: settings.spond_group_name,
          spondParentGroupName: settings.spond_parent_group_name,
          isSubgroup: settings.is_subgroup,
          syncEventsImport: settings.sync_events_import,
          syncEventsExport: settings.sync_events_export,
          syncAttendanceImport: settings.sync_attendance_import,
          syncEventTitle: settings.sync_event_title,
          syncEventDescription: settings.sync_event_description,
          syncEventTime: settings.sync_event_time,
          syncEventLocation: settings.sync_event_location,
          syncEventType: settings.sync_event_type,
          isActive: settings.is_active
        })
      })

      if (response.ok) {
        toast.success('Sync settings saved')
        setEditingSyncSettings(null)
        fetchSyncSettings()
      } else {
        toast.error('Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save settings')
    }
  }

  // Delete sync settings (unlink)
  const deleteSyncSettings = async (teamId: number) => {
    if (!confirm('Are you sure you want to unlink this team from Spond?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/spond/sync-settings/${teamId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })

      if (response.ok) {
        toast.success('Team unlinked from Spond')
        fetchSyncSettings()
      } else {
        toast.error('Failed to unlink team')
      }
    } catch (error) {
      toast.error('Failed to unlink team')
    }
  }

  // Sync with settings (respects per-team configuration)
  const syncWithSettings = async (direction: 'import' | 'export' | 'both') => {
    setSyncing(true)
    try {
      const response = await fetch('/api/spond/sync-with-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          direction,
          daysAhead: 60,
          daysBehind: 7
        })
      })

      const result = await response.json()
      if (result.success) {
        const message = direction === 'import' 
          ? `Imported ${result.imported} events, updated ${result.attendanceUpdated} attendance records`
          : direction === 'export'
          ? `Exported ${result.exported} events`
          : `Synced: ${result.imported} imported, ${result.exported} exported, ${result.attendanceUpdated} attendance`
        toast.success(message)
        fetchStatus()
      } else {
        toast.error(result.error || 'Sync failed')
      }
    } catch (error) {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowsClockwise className="animate-spin" size={20} />
            Loading Spond status...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Spond Integration
                  {status?.configured && (
                    <Badge 
                      variant={status.connected ? 'default' : 'secondary'}
                      className={status.connected ? 'bg-green-600' : ''}
                    >
                      {status.connected ? 'Connected' : 'Configured'}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Sync events and teams with Spond.com
                </CardDescription>
              </div>
            </div>
            
            {!status?.configured ? (
              <Button onClick={() => setShowSetupWizard(true)} style={{ backgroundColor: COLORS.ACCENT }}>
                <Gear size={16} className="mr-2" />
                Connect
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowSetupWizard(true)}
                >
                  <Gear size={16} className="mr-2" />
                  Setup
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={removeConfiguration}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X size={16} />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Features list */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <CloudArrowDown size={18} className="mt-0.5 flex-shrink-0" style={{ color: COLORS.ACCENT }} />
              <span>Import events and training sessions automatically</span>
            </div>
            <div className="flex items-start gap-2">
              <Users size={18} className="mt-0.5 flex-shrink-0" style={{ color: COLORS.ACCENT }} />
              <span>Link Spond teams/subgroups to local teams</span>
            </div>
            <div className="flex items-start gap-2">
              <UserCheck size={18} className="mt-0.5 flex-shrink-0" style={{ color: COLORS.ACCENT }} />
              <span>Track attendance (accepted, declined, pending)</span>
            </div>
          </div>

          {status?.configured && (
            <>
              <Separator />
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{status.syncedGroups}</div>
                  <div className="text-xs text-muted-foreground">Synced Teams</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{status.syncedEvents}</div>
                  <div className="text-xs text-muted-foreground">Synced Events</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Last Sync</div>
                  <div className="text-sm font-medium">
                    {status.lastSync 
                      ? new Date(status.lastSync).toLocaleString() 
                      : 'Never'}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                {/* Primary sync action */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setShowSyncWizard(true)}
                    style={{ backgroundColor: COLORS.ACCENT }}
                  >
                    <ArrowsClockwise size={16} className="mr-2" />
                    Sync Now
                  </Button>
                </div>
                
                {/* Team management actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={openImportDialog}
                  >
                    <Download size={16} className="mr-2" />
                    Import Teams from Spond
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={openMappingDialog}
                  >
                    <LinkIcon size={16} className="mr-2" />
                    Link Teams
                  </Button>

                  <Button
                    variant="outline"
                    onClick={openSyncSettingsDialog}
                  >
                    <Sliders size={16} className="mr-2" />
                    Sync Settings
                  </Button>
                </div>
              </div>
            </>
          )}

          {!status?.configured && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-start gap-3">
                <Lightning size={20} weight="fill" style={{ color: COLORS.ACCENT }} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm mb-1">
                    <strong>Spond</strong> is a team management app used by sports clubs worldwide.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Connect your Spond account to import events, sync teams, and track attendance automatically.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="bg-white border border-gray-200 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${COLORS.ACCENT}, ${COLORS.NAVY})` }}
              >
                <Lightning size={18} weight="fill" className="text-white" />
              </div>
              Configure Spond Integration
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Enter your Spond credentials to connect your account. 
              These are the same credentials you use to log into Spond.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spond-username" className="text-gray-700 font-medium">Spond Email</Label>
              <Input
                id="spond-username"
                type="email"
                placeholder="your-email@example.com"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="bg-gray-50 border-gray-300 text-gray-900 focus:border-[#248bcc] focus:ring-[#248bcc]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spond-password" className="text-gray-700 font-medium">Spond Password</Label>
              <Input
                id="spond-password"
                type="password"
                placeholder="••••••••"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="bg-gray-50 border-gray-300 text-gray-900 focus:border-[#248bcc] focus:ring-[#248bcc]"
              />
            </div>

            <Separator className="bg-gray-200" />

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm text-gray-700 font-medium">Auto-sync enabled</Label>
                <p className="text-xs text-gray-500">Automatically sync data periodically</p>
              </div>
              <Switch
                checked={credentials.autoSync}
                onCheckedChange={(checked) => setCredentials({ ...credentials, autoSync: checked })}
              />
            </div>

            {credentials.autoSync && (
              <div className="space-y-2">
                <Label htmlFor="sync-interval" className="text-gray-700 font-medium">Sync Interval (minutes)</Label>
                <Input
                  id="sync-interval"
                  type="number"
                  min={15}
                  max={1440}
                  value={credentials.syncIntervalMinutes}
                  onChange={(e) => setCredentials({ ...credentials, syncIntervalMinutes: parseInt(e.target.value) || 60 })}
                  className="bg-gray-50 border-gray-300 text-gray-900 focus:border-[#248bcc] focus:ring-[#248bcc]"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={testingConnection}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              {testingConnection ? (
                <ArrowsClockwise className="animate-spin mr-2" size={16} />
              ) : (
                <Check size={16} className="mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={saveConfiguration}
              className="bg-[#248bcc] hover:bg-[#1a6a9a] text-white"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="bg-white border border-gray-200 shadow-xl sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${COLORS.ACCENT}, ${COLORS.NAVY})` }}
              >
                <LinkIcon size={18} weight="bold" className="text-white" />
              </div>
              Link Teams
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Connect your Spond teams and subgroups to existing local teams, or import new teams from Spond.
            </DialogDescription>
          </DialogHeader>

          {/* Legend and Import button */}
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.NAVY }}></div>
                <span className="text-gray-600 font-medium">Spond Team/Subgroup</span>
              </div>
              <div className="text-gray-400">→</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.ACCENT }}></div>
                <span className="text-gray-600 font-medium">Local Team</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setShowMappingDialog(false); openImportDialog(); }}
              className="text-xs"
            >
              <Download size={14} className="mr-1" />
              Import from Spond
            </Button>
          </div>

          <ScrollArea className="max-h-[50vh]">
            {loadingGroups ? (
              <div className="flex items-center justify-center py-8">
                <ArrowsClockwise className="animate-spin" size={32} style={{ color: COLORS.ACCENT }} />
              </div>
            ) : (
              <div className="space-y-3">
                {spondGroups.map((group) => (
                  <div
                    key={group.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.NAVY }}></div>
                        <span className="font-medium text-gray-900">{group.name}</span>
                        {group.parentGroup && (
                          <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">
                            Subgroup
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs border-gray-300 text-gray-600 bg-white">
                          {group.memberCount} members
                        </Badge>
                      </div>
                      {group.parentGroup && (
                        <span className="text-sm text-gray-500 ml-4">in {group.parentGroup}</span>
                      )}
                      {!group.parentGroup && group.activity && (
                        <span className="text-sm text-gray-500 ml-4">{group.activity}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {group.linkedTeam ? (
                        <>
                          <Badge className="bg-[#248bcc]/10 text-[#248bcc] border border-[#248bcc]/30">
                            <CheckCircle size={12} className="mr-1" />
                            {group.linkedTeam.name}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkTeam(group.linkedTeam!.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <LinkBreak size={16} />
                          </Button>
                        </>
                      ) : (
                        <select
                          className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:border-[#248bcc] focus:ring-1 focus:ring-[#248bcc]"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              linkTeam(parseInt(e.target.value), group.id)
                            }
                          }}
                        >
                          <option value="">Select local team...</option>
                          {teams
                            .filter(t => !t.spond_group_id)
                            .map(team => (
                              <option key={team.id} value={team.id}>
                                {team.name} ({team.sport})
                              </option>
                            ))
                          }
                        </select>
                      )}
                    </div>
                  </div>
                ))}

                {spondGroups.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                      <Warning size={32} className="text-gray-400" />
                    </div>
                    <p className="text-gray-700 font-medium">No Spond teams found</p>
                    <p className="text-sm text-gray-500">Make sure you're a member of at least one team in Spond</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMappingDialog(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Teams from Spond Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-white border border-gray-200 shadow-xl sm:max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${COLORS.ACCENT}, ${COLORS.NAVY})` }}
              >
                <Download size={18} className="text-white" />
              </div>
              Import Teams from Spond
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Create local teams from your Spond groups and subgroups. Select the teams you want to import and configure their sync settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Import settings */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <Label className="text-sm font-medium text-gray-700">Import Settings</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Sport Type</Label>
                  <Select value={importSport} onValueChange={setImportSport}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tackle Football">Tackle Football</SelectItem>
                      <SelectItem value="Flag Football">Flag Football</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox 
                    checked={importSettings.syncEventsImport}
                    onCheckedChange={(checked) => setImportSettings({...importSettings, syncEventsImport: !!checked})}
                  />
                  <span className="flex items-center gap-1">
                    <CloudArrowDown size={14} />
                    Import events
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox 
                    checked={importSettings.syncEventsExport}
                    onCheckedChange={(checked) => setImportSettings({...importSettings, syncEventsExport: !!checked})}
                  />
                  <span className="flex items-center gap-1">
                    <CloudArrowUp size={14} />
                    Export events
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox 
                    checked={importSettings.syncAttendanceImport}
                    onCheckedChange={(checked) => setImportSettings({...importSettings, syncAttendanceImport: !!checked})}
                  />
                  <span className="flex items-center gap-1">
                    <UserCheck size={14} />
                    Sync attendance
                  </span>
                </label>
              </div>
            </div>

            <ScrollArea className="max-h-[40vh]">
              {loadingImportable ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowsClockwise className="animate-spin" size={32} style={{ color: COLORS.ACCENT }} />
                </div>
              ) : importableGroups.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <p className="text-gray-700 font-medium">All Spond teams are already imported!</p>
                  <p className="text-sm text-gray-500">No new teams available to import</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2 py-1 text-xs text-gray-500">
                    <span>{selectedForImport.size} of {importableGroups.length} selected</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs"
                      onClick={() => {
                        if (selectedForImport.size === importableGroups.length) {
                          setSelectedForImport(new Set())
                        } else {
                          setSelectedForImport(new Set(importableGroups.map(g => g.id)))
                        }
                      }}
                    >
                      {selectedForImport.size === importableGroups.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  
                  {importableGroups.map((group) => (
                    <label
                      key={group.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedForImport.has(group.id) 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Checkbox 
                        checked={selectedForImport.has(group.id)}
                        onCheckedChange={() => toggleImportSelection(group.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{group.name}</span>
                          {group.isSubgroup && (
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">
                              Subgroup
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs border-gray-300 text-gray-600 bg-white">
                            {group.memberCount} members
                          </Badge>
                        </div>
                        {group.parentGroup && (
                          <span className="text-sm text-gray-500">in {group.parentGroup}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={importSelectedTeams}
              disabled={importing || selectedForImport.size === 0}
              className="bg-[#248bcc] hover:bg-[#1a6a9a] text-white"
            >
              {importing ? (
                <ArrowsClockwise className="animate-spin mr-2" size={16} />
              ) : (
                <Plus size={16} className="mr-2" />
              )}
              Import {selectedForImport.size} Team{selectedForImport.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Settings Dialog */}
      <Dialog open={showSyncSettingsDialog} onOpenChange={setShowSyncSettingsDialog}>
        <DialogContent className="bg-white border border-gray-200 shadow-xl sm:max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${COLORS.ACCENT}, ${COLORS.NAVY})` }}
              >
                <Sliders size={18} className="text-white" />
              </div>
              Sync Settings
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Configure what to sync for each team-Spond group connection. Control import/export direction and which attributes to sync.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {loadingSyncSettings ? (
              <div className="flex items-center justify-center py-8">
                <ArrowsClockwise className="animate-spin" size={32} style={{ color: COLORS.ACCENT }} />
              </div>
            ) : syncSettings.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <LinkIcon size={32} className="text-gray-400" />
                </div>
                <p className="text-gray-700 font-medium">No teams linked to Spond</p>
                <p className="text-sm text-gray-500 mb-4">Link teams or import from Spond to configure sync settings</p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowSyncSettingsDialog(false); openMappingDialog(); }}>
                    <LinkIcon size={14} className="mr-2" />
                    Link Teams
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setShowSyncSettingsDialog(false); openImportDialog(); }}>
                    <Download size={14} className="mr-2" />
                    Import from Spond
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {syncSettings.map((settings) => (
                  <div
                    key={settings.team_id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{settings.team_name}</span>
                          <ArrowRight size={14} className="text-gray-400" />
                          <span className="text-gray-600">{settings.spond_group_name || settings.spond_group_id}</span>
                          {settings.is_subgroup && (
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">
                              Subgroup
                            </Badge>
                          )}
                        </div>
                        {settings.spond_parent_group_name && (
                          <span className="text-xs text-gray-500">in {settings.spond_parent_group_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={settings.is_active}
                          onCheckedChange={(checked) => saveSyncSettings({...settings, is_active: checked})}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSyncSettings(settings.team_id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <LinkBreak size={16} />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Sync direction controls */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <label className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                        <Checkbox 
                          checked={settings.sync_events_import}
                          onCheckedChange={(checked) => saveSyncSettings({...settings, sync_events_import: !!checked})}
                        />
                        <CloudArrowDown size={16} className="text-green-600" />
                        <span className="text-sm">Import Events</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                        <Checkbox 
                          checked={settings.sync_events_export}
                          onCheckedChange={(checked) => saveSyncSettings({...settings, sync_events_export: !!checked})}
                        />
                        <CloudArrowUp size={16} className="text-blue-600" />
                        <span className="text-sm">Export Events</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                        <Checkbox 
                          checked={settings.sync_attendance_import}
                          onCheckedChange={(checked) => saveSyncSettings({...settings, sync_attendance_import: !!checked})}
                        />
                        <UserCheck size={16} className="text-purple-600" />
                        <span className="text-sm">Attendance</span>
                      </label>
                    </div>
                    
                    {/* Attribute sync controls */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-gray-500 py-1">Sync attributes:</span>
                      {[
                        { key: 'sync_event_title', label: 'Title' },
                        { key: 'sync_event_description', label: 'Description' },
                        { key: 'sync_event_time', label: 'Time' },
                        { key: 'sync_event_location', label: 'Location' },
                        { key: 'sync_event_type', label: 'Type' },
                      ].map(attr => (
                        <label 
                          key={attr.key}
                          className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors ${
                            (settings as any)[attr.key] 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}
                        >
                          <Checkbox 
                            checked={(settings as any)[attr.key]}
                            onCheckedChange={(checked) => saveSyncSettings({...settings, [attr.key]: !!checked})}
                            className="h-3 w-3"
                          />
                          {attr.label}
                        </label>
                      ))}
                    </div>
                    
                    {/* Last sync info */}
                    {(settings.last_import_sync || settings.last_export_sync || settings.last_attendance_sync) && (
                      <div className="flex gap-4 mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                        {settings.last_import_sync && (
                          <span>Last import: {new Date(settings.last_import_sync).toLocaleString()}</span>
                        )}
                        {settings.last_attendance_sync && (
                          <span>Last attendance: {new Date(settings.last_attendance_sync).toLocaleString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSyncSettingsDialog(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spond Setup Wizard */}
      <SpondSetupWizard
        open={showSetupWizard}
        onOpenChange={setShowSetupWizard}
        onComplete={() => {
          fetchStatus()
        }}
      />

      {/* Spond Sync Wizard */}
      <SpondSyncWizard
        open={showSyncWizard}
        onOpenChange={setShowSyncWizard}
        onComplete={() => {
          fetchStatus()
        }}
      />
    </>
  )
}
