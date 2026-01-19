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
  Question
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { api, getToken } from '@/lib/api'
import { COLORS } from '@/lib/constants'

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
  const [showMappingDialog, setShowMappingDialog] = useState(false)
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
              {/* Spond Logo */}
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${COLORS.ACCENT}, ${COLORS.NAVY})` }}
              >
                <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M70 25C70 25 60 25 50 25C35 25 25 35 25 50C25 58 29 65 35 70" stroke="white" strokeWidth="8" strokeLinecap="round" fill="none"/>
                  <path d="M30 75C30 75 40 75 50 75C65 75 75 65 75 50C75 42 71 35 65 30" stroke="white" strokeWidth="8" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
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
              <Button onClick={() => setShowConfigDialog(true)} style={{ backgroundColor: COLORS.ACCENT }}>
                <Gear size={16} className="mr-2" />
                Connect
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowConfigDialog(true)}
                >
                  <Gear size={16} className="mr-2" />
                  Settings
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
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => triggerSync('full')}
                  disabled={syncing}
                  style={{ backgroundColor: COLORS.ACCENT }}
                >
                  {syncing ? (
                    <ArrowsClockwise className="animate-spin mr-2" size={16} />
                  ) : (
                    <CloudArrowDown size={16} className="mr-2" />
                  )}
                  Sync All
                </Button>

                <Button
                  variant="outline"
                  onClick={() => triggerSync('events')}
                  disabled={syncing}
                >
                  <CalendarBlank size={16} className="mr-2" />
                  Sync Events
                </Button>

                <Button
                  variant="outline"
                  onClick={() => triggerSync('groups')}
                  disabled={syncing}
                >
                  <Users size={16} className="mr-2" />
                  Sync Teams
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
                  onClick={syncAttendance}
                  disabled={syncingAttendance || syncing}
                >
                  {syncingAttendance ? (
                    <ArrowsClockwise className="animate-spin mr-2" size={16} />
                  ) : (
                    <UserCheck size={16} className="mr-2" />
                  )}
                  Sync Attendance
                </Button>
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
              Connect your Spond teams and subgroups to local teams. Events from linked Spond teams will sync to the corresponding local team.
            </DialogDescription>
          </DialogHeader>

          {/* Legend */}
          <div className="flex items-center gap-6 py-2 px-3 bg-gray-50 rounded-lg text-xs">
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
    </>
  )
}
