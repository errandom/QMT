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
  Circle
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { COLORS } from '@/lib/constants'

interface SpondStatus {
  configured: boolean
  connected: boolean
  lastSync: string | null
  syncedGroups: number
  syncedEvents: number
}

interface SpondGroup {
  id: string
  name: string
  activity?: string
  memberCount: number
  subGroupCount: number
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),
        fetch('/api/teams', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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

  if (loading) {
    return (
      <Card className="glass-card border-white/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-white/70">
            <ArrowsClockwise className="animate-spin" size={20} />
            Loading Spond status...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="glass-card border-white/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                <Lightning size={24} weight="fill" className="text-white" />
              </div>
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  Spond Integration
                  {status?.configured && (
                    <Badge 
                      variant="secondary" 
                      className={status.connected ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}
                    >
                      {status.connected ? 'Connected' : 'Configured'}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-white/60">
                  Sync events and teams with Spond.com
                </CardDescription>
              </div>
            </div>
            
            {!status?.configured ? (
              <Button 
                onClick={() => setShowConfigDialog(true)}
                className="bg-[#248bcc] hover:bg-[#1a6a9a]"
              >
                <Gear size={16} className="mr-2" />
                Configure
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowConfigDialog(true)}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <Gear size={16} />
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={removeConfiguration}
                >
                  <X size={16} />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        {status?.configured && (
          <CardContent className="pt-4">
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{status.syncedGroups}</div>
                  <div className="text-xs text-white/60">Synced Teams</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{status.syncedEvents}</div>
                  <div className="text-xs text-white/60">Synced Events</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-white/60 mb-1">Last Sync</div>
                  <div className="text-sm text-white">
                    {status.lastSync 
                      ? new Date(status.lastSync).toLocaleString() 
                      : 'Never'}
                  </div>
                </div>
              </div>

              <Separator className="bg-white/10" />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => triggerSync('full')}
                  disabled={syncing}
                  className="bg-[#248bcc] hover:bg-[#1a6a9a]"
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
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <CalendarBlank size={16} className="mr-2" />
                  Sync Events
                </Button>

                <Button
                  variant="outline"
                  onClick={() => triggerSync('groups')}
                  disabled={syncing}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <Users size={16} className="mr-2" />
                  Sync Teams
                </Button>

                <Button
                  variant="outline"
                  onClick={openMappingDialog}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <LinkIcon size={16} className="mr-2" />
                  Team Mappings
                </Button>
              </div>
            </div>
          </CardContent>
        )}

        {!status?.configured && (
          <CardContent className="pt-0">
            <p className="text-white/60 text-sm">
              Connect your Spond account to automatically sync events and team information 
              between Spond and this application.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="glass-card border-white/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightning size={24} className="text-green-400" />
              Configure Spond Integration
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Enter your Spond credentials to connect your account. 
              These are the same credentials you use to log into Spond.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spond-username">Spond Email</Label>
              <Input
                id="spond-username"
                type="email"
                placeholder="your-email@example.com"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spond-password">Spond Password</Label>
              <Input
                id="spond-password"
                type="password"
                placeholder="••••••••"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>

            <Separator className="bg-white/10" />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Auto-sync enabled</Label>
                <p className="text-xs text-white/60">Automatically sync data periodically</p>
              </div>
              <Switch
                checked={credentials.autoSync}
                onCheckedChange={(checked) => setCredentials({ ...credentials, autoSync: checked })}
              />
            </div>

            {credentials.autoSync && (
              <div className="space-y-2">
                <Label htmlFor="sync-interval">Sync Interval (minutes)</Label>
                <Input
                  id="sync-interval"
                  type="number"
                  min={15}
                  max={1440}
                  value={credentials.syncIntervalMinutes}
                  onChange={(e) => setCredentials({ ...credentials, syncIntervalMinutes: parseInt(e.target.value) || 60 })}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={testingConnection}
              className="border-white/20 text-white hover:bg-white/10"
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
              className="bg-[#248bcc] hover:bg-[#1a6a9a]"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="glass-card border-white/20 text-white sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon size={24} className="text-blue-400" />
              Team Mappings
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Link your local teams to Spond groups for synchronized data.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh]">
            {loadingGroups ? (
              <div className="flex items-center justify-center py-8">
                <ArrowsClockwise className="animate-spin text-white/60" size={32} />
              </div>
            ) : (
              <div className="space-y-3">
                {spondGroups.map((group) => (
                  <div
                    key={group.id}
                    className="bg-white/5 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{group.name}</span>
                        <Badge variant="outline" className="text-xs border-white/20 text-white/60">
                          {group.memberCount} members
                        </Badge>
                      </div>
                      {group.activity && (
                        <span className="text-sm text-white/60">{group.activity}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {group.linkedTeam ? (
                        <>
                          <Badge className="bg-green-500/20 text-green-300">
                            <CheckCircle size={12} className="mr-1" />
                            {group.linkedTeam.name}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkTeam(group.linkedTeam!.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <LinkBreak size={16} />
                          </Button>
                        </>
                      ) : (
                        <select
                          className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              linkTeam(parseInt(e.target.value), group.id)
                            }
                          }}
                        >
                          <option value="" className="bg-gray-800">Link to team...</option>
                          {teams
                            .filter(t => !t.spond_group_id)
                            .map(team => (
                              <option key={team.id} value={team.id} className="bg-gray-800">
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
                  <div className="text-center py-8 text-white/60">
                    <Warning size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No Spond groups found</p>
                    <p className="text-sm">Make sure you're a member of at least one group in Spond</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMappingDialog(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
