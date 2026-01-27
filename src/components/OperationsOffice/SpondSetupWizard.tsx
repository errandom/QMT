import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ArrowsClockwise, 
  Check, 
  X, 
  Lightning, 
  ArrowRight,
  ArrowLeft,
  Users,
  LinkSimple,
  CheckCircle,
  Warning,
  Gear,
  ShieldCheck,
  CaretDown,
  CaretUp,
  PencilSimple,
  LinkBreak,
  Circle,
  CalendarBlank,
  UserCheck,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { getToken } from '@/lib/api'
import { COLORS } from '@/lib/constants'

interface Team {
  id: number
  name: string
  sport: string
  spond_group_id?: string
}

interface SpondGroup {
  id: string
  name: string
  parentGroup?: string | null
  parentGroupId?: string
  activity?: string
  memberCount: number
  linkedTeam?: { id: number; name: string } | null
  linkedTeams?: { id: number; name: string }[] // Support for 1:n mapping
  isSubgroup?: boolean
  isParentGroup?: boolean
  hasSubgroups?: boolean
}

interface TeamMapping {
  teamId: number
  teamName: string
  spondGroupId: string
  spondGroupName: string
  spondParentGroupName?: string
  isSubgroup: boolean
}

interface SpondSetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  existingCredentials?: {
    username: string
    hasPassword: boolean
  }
}

export default function SpondSetupWizard({
  open,
  onOpenChange,
  onComplete,
  existingCredentials,
}: SpondSetupWizardProps) {
  const [step, setStep] = useState(1)
  const totalSteps = 3
  
  // Step 1: Credentials
  const [credentials, setCredentials] = useState({
    username: existingCredentials?.username || '',
    password: '',
    autoSync: false,
    syncIntervalMinutes: 60
  })
  
  // Step 2: Connection test result
  const [testingConnection, setTestingConnection] = useState(false)
  const [testPhase, setTestPhase] = useState<'connecting' | 'permissions' | 'done'>('connecting')
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean
    message: string
    groupCount?: number
    permissions?: {
      canReadGroups: boolean
      canReadEvents: boolean
      canReadMembers: boolean
      groupsAccessible: number
      eventsAccessible: number
    }
  } | null>(null)
  
  // Step 3: Team mapping
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [spondGroups, setSpondGroups] = useState<SpondGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [teamMappings, setTeamMappings] = useState<Map<number, TeamMapping>>(new Map())
  const [showMappingSummary, setShowMappingSummary] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null)
  // Track selected parent group per team for cascading selection
  const [selectedParentGroup, setSelectedParentGroup] = useState<Map<number, string>>(new Map())
  
  // Saving state
  const [saving, setSaving] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1)
      setConnectionTestResult(null)
      setCredentials({
        username: existingCredentials?.username || '',
        password: '',
        autoSync: false,
        syncIntervalMinutes: 60
      })
      setTeamMappings(new Map())
      setSelectedParentGroup(new Map())
    }
  }, [open, existingCredentials])

  // Fetch teams and Spond groups when entering step 3
  useEffect(() => {
    if (step === 3 && connectionTestResult?.success) {
      fetchTeamsAndGroups()
    }
  }, [step, connectionTestResult])

  const fetchTeamsAndGroups = async () => {
    setLoadingGroups(true)
    try {
      // First save credentials temporarily to allow groups fetch
      await saveTempCredentials()
      
      const [teamsResponse, groupsResponse] = await Promise.all([
        fetch('/api/teams', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch('/api/spond/groups', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
      ])

      let teamsData: Team[] = []
      let groups: SpondGroup[] = []

      if (teamsResponse.ok) {
        teamsData = await teamsResponse.json()
        setAllTeams(teamsData)
        
        // Pre-populate mappings for already linked teams
        const linkedTeams = teamsData.filter((t: Team) => t.spond_group_id)
        const existingMappings = new Map<number, TeamMapping>()
        linkedTeams.forEach((t: Team) => {
          existingMappings.set(t.id, {
            teamId: t.id,
            teamName: t.name,
            spondGroupId: t.spond_group_id!,
            spondGroupName: '',
            isSubgroup: false
          })
        })
        setTeamMappings(existingMappings)
      }

      if (groupsResponse.ok) {
        groups = await groupsResponse.json()
        setSpondGroups(groups)
        
        // Set the selected parent group for any existing mappings
        const linkedTeams = teamsData.filter((t: Team) => t.spond_group_id)
        const parentSelections = new Map<number, string>()
        
        linkedTeams.forEach((t: Team) => {
          if (t.spond_group_id) {
            // Find this group in the groups list
            const matchedGroup = groups.find((g: SpondGroup) => g.id === t.spond_group_id)
            if (matchedGroup) {
              // If it's a parent group, select it directly
              // If it's a subgroup, select its parent
              const parentId = matchedGroup.isParentGroup ? matchedGroup.id : matchedGroup.parentGroupId
              if (parentId) {
                parentSelections.set(t.id, parentId)
              }
            }
          }
        })
        setSelectedParentGroup(parentSelections)
      } else {
        toast.error('Failed to fetch Spond groups')
      }
    } catch (error) {
      console.error('Error fetching teams/groups:', error)
      toast.error('Failed to load data')
    } finally {
      setLoadingGroups(false)
    }
  }

  const saveTempCredentials = async () => {
    // Save credentials to enable API calls
    const response = await fetch('/api/spond/configure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
        autoSync: false,
        syncIntervalMinutes: 60
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to save credentials')
    }
  }

  const testConnection = async () => {
    if (!credentials.username || !credentials.password) {
      toast.error('Please enter your Spond credentials')
      return
    }

    setTestingConnection(true)
    setConnectionTestResult(null)
    setTestPhase('connecting')
    
    try {
      // Phase 1: Test basic connection
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

      // Check if response is OK and is JSON before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[Spond] Server returned non-JSON response:', response.status, contentType)
        throw new Error('Server error: Unable to connect to Spond API. Please try again later.')
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Connection test failed (${response.status})`)
      }

      const result = await response.json()
      
      if (!result.success) {
        setConnectionTestResult({
          success: false,
          message: result.message || 'Connection test failed. Please check your credentials.'
        })
        setTestingConnection(false)
        return
      }

      // Phase 2: Check permissions by fetching groups
      setTestPhase('permissions')
      
      // Save credentials temporarily to enable API calls
      const configResponse = await fetch('/api/spond/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          autoSync: false,
          syncIntervalMinutes: 60
        })
      })

      if (!configResponse.ok) {
        const errorData = await configResponse.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to configure Spond connection')
      }

      // Check what we can access
      const permissionChecks = await Promise.allSettled([
        fetch('/api/spond/groups', { headers: { 'Authorization': `Bearer ${getToken()}` } }),
        fetch('/api/spond/events-count', { headers: { 'Authorization': `Bearer ${getToken()}` } }).catch(() => null)
      ])

      const groupsResult = permissionChecks[0]
      const eventsResult = permissionChecks[1]

      let groupsAccessible = 0
      let eventsAccessible = 0
      let canReadGroups = false
      let canReadEvents = false
      let canReadMembers = false

      if (groupsResult.status === 'fulfilled' && groupsResult.value.ok) {
        const groups = await groupsResult.value.json()
        groupsAccessible = Array.isArray(groups) ? groups.length : 0
        canReadGroups = groupsAccessible > 0
        canReadMembers = groups.some((g: any) => g.memberCount > 0)
      }

      if (eventsResult.status === 'fulfilled' && eventsResult.value?.ok) {
        const eventsData = await eventsResult.value.json()
        eventsAccessible = eventsData.count || 0
        canReadEvents = true
      } else {
        // If events-count endpoint doesn't exist, assume events are accessible if groups are
        canReadEvents = canReadGroups
      }

      setTestPhase('done')
      setConnectionTestResult({
        success: true,
        message: 'Connection successful!',
        groupCount: groupsAccessible,
        permissions: {
          canReadGroups,
          canReadEvents,
          canReadMembers,
          groupsAccessible,
          eventsAccessible
        }
      })
      
      // Automatically proceed to step 3 after a short delay
      setTimeout(() => {
        setStep(3)
      }, 2500)
    } catch (error) {
      console.error('[Spond Setup] Connection test error:', error)
      setConnectionTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed. Please check your credentials.'
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleTeamMappingChange = (teamId: number, spondGroupId: string) => {
    const team = allTeams.find(t => t.id === teamId)
    const spondGroup = spondGroups.find(g => g.id === spondGroupId)
    
    if (!team) return
    
    const newMappings = new Map(teamMappings)
    
    if (spondGroupId === 'none') {
      newMappings.delete(teamId)
    } else if (spondGroup) {
      newMappings.set(teamId, {
        teamId: team.id,
        teamName: team.name,
        spondGroupId: spondGroup.id,
        spondGroupName: spondGroup.name,
        spondParentGroupName: spondGroup.parentGroup || undefined,
        isSubgroup: !!spondGroup.parentGroup
      })
    }
    
    setTeamMappings(newMappings)
    setEditingTeamId(null)
  }

  const saveConfiguration = async () => {
    setSaving(true)
    
    try {
      // 1. Save the final configuration with auto-sync settings
      const configResponse = await fetch('/api/spond/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(credentials)
      })

      if (!configResponse.ok) {
        throw new Error('Failed to save configuration')
      }

      // 2. Save all team mappings
      const mappingPromises = Array.from(teamMappings.values()).map(mapping =>
        fetch('/api/spond/link/team', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            teamId: mapping.teamId,
            spondGroupId: mapping.spondGroupId
          })
        })
      )

      await Promise.all(mappingPromises)

      // 3. Trigger initial event sync if there are team mappings
      if (teamMappings.size > 0) {
        toast.info('Syncing events from Spond...')
        try {
          const syncResponse = await fetch('/api/spond/sync/events', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
              daysAhead: 60,
              daysBehind: 7
            })
          })
          
          if (syncResponse.ok) {
            const syncResult = await syncResponse.json()
            toast.success(`Synced ${syncResult.imported || 0} events from Spond!`)
          } else {
            console.warn('Event sync failed, but configuration was saved')
          }
        } catch (syncError) {
          console.warn('Event sync error:', syncError)
          // Don't fail the whole operation if sync fails
        }
      }

      toast.success('Spond integration configured successfully!')
      onComplete()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving configuration:', error)
      toast.error('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return credentials.username && credentials.password
      case 2:
        return connectionTestResult?.success
      case 3:
        return true // Mappings are optional
      default:
        return false
    }
  }

  const handleNext = () => {
    if (step === 1) {
      // Go to step 2 and test connection
      setStep(2)
      testConnection()
    } else if (step === 2 && connectionTestResult?.success) {
      setStep(3)
    } else if (step === 3) {
      saveConfiguration()
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
      if (step === 2) {
        setConnectionTestResult(null)
      }
    }
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
        return { title: 'Enter Credentials', description: 'Enter your Spond login credentials' }
      case 2:
        return { title: 'Test Connection', description: 'Verifying your Spond account' }
      case 3:
        return { title: 'Link Teams', description: 'Map your teams to Spond groups' }
      default:
        return { title: '', description: '' }
    }
  }

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Secure Connection</p>
            <p className="text-blue-600 mt-1">
              Your credentials are used only to connect to Spond and are stored securely.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="spond-email" className="text-gray-700 font-medium">
          Spond Email
        </Label>
        <Input
          id="spond-email"
          type="email"
          placeholder="your-email@example.com"
          value={credentials.username}
          onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
          className="bg-gray-50 border-gray-300"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="spond-password" className="text-gray-700 font-medium">
          Spond Password
        </Label>
        <Input
          id="spond-password"
          type="password"
          placeholder="••••••••"
          value={credentials.password}
          onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
          className="bg-gray-50 border-gray-300"
        />
      </div>

      <Separator />

      <div className="space-y-4">
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
            <Label htmlFor="sync-interval" className="text-gray-700 font-medium">
              Sync Interval (minutes)
            </Label>
            <Input
              id="sync-interval"
              type="number"
              min={15}
              max={1440}
              value={credentials.syncIntervalMinutes}
              onChange={(e) => setCredentials({ ...credentials, syncIntervalMinutes: parseInt(e.target.value) || 60 })}
              className="bg-gray-50 border-gray-300"
            />
          </div>
        )}
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6 py-6">
      <div className="flex flex-col items-center justify-center">
        {testingConnection ? (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <ArrowsClockwise className="animate-spin text-blue-600" size={32} />
            </div>
            <p className="text-lg font-medium text-gray-700">
              {testPhase === 'connecting' ? 'Connecting to Spond...' : 'Checking permissions...'}
            </p>
            <p className="text-sm text-gray-500">
              {testPhase === 'connecting' 
                ? 'Verifying your credentials' 
                : 'Checking what data you can access'}
            </p>
            
            {/* Progress indicator */}
            <div className="flex items-center gap-3 mt-6">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                testPhase === 'connecting' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {testPhase === 'connecting' 
                  ? <ArrowsClockwise className="animate-spin" size={14} />
                  : <CheckCircle size={14} weight="fill" />
                }
                <span>Connection</span>
              </div>
              <div className="w-4 h-0.5 bg-gray-200" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                testPhase === 'permissions' 
                  ? 'bg-blue-100 text-blue-700' 
                  : testPhase === 'done'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {testPhase === 'permissions' 
                  ? <ArrowsClockwise className="animate-spin" size={14} />
                  : testPhase === 'done'
                  ? <CheckCircle size={14} weight="fill" />
                  : <Circle size={14} />
                }
                <span>Permissions</span>
              </div>
            </div>
          </>
        ) : connectionTestResult ? (
          connectionTestResult.success ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="text-green-600" size={32} weight="fill" />
              </div>
              <p className="text-lg font-medium text-green-700">Connection successful!</p>
              
              {/* Permission details */}
              {connectionTestResult.permissions && (
                <div className="mt-4 w-full max-w-sm space-y-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2 text-center">
                    Account Permissions
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-600">
                        <Users size={16} />
                        Read Groups
                      </span>
                      {connectionTestResult.permissions.canReadGroups ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={14} weight="fill" />
                          {connectionTestResult.permissions.groupsAccessible} groups
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500">
                          <X size={14} />
                          No access
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-600">
                        <CalendarBlank size={16} />
                        Read Events
                      </span>
                      {connectionTestResult.permissions.canReadEvents ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={14} weight="fill" />
                          Available
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Warning size={14} />
                          Limited
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-600">
                        <UserCheck size={16} />
                        Read Members
                      </span>
                      {connectionTestResult.permissions.canReadMembers ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={14} weight="fill" />
                          Available
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Warning size={14} />
                          Limited
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-400 mt-4">Proceeding to team mapping...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Warning className="text-red-600" size={32} weight="fill" />
              </div>
              <p className="text-lg font-medium text-red-700">Connection failed</p>
              <p className="text-sm text-gray-500 mt-1 text-center max-w-sm">
                {connectionTestResult.message}
              </p>
              <Button
                variant="outline"
                onClick={() => { setStep(1); setConnectionTestResult(null) }}
                className="mt-4"
              >
                <ArrowLeft size={16} className="mr-2" />
                Try again
              </Button>
            </>
          )
        ) : null}
      </div>
    </div>
  )

  // Helper to get Spond group name by ID
  const getSpondGroupName = (groupId: string) => {
    const group = spondGroups.find(g => g.id === groupId)
    if (!group) return groupId
    if (group.parentGroup) {
      return `${group.name} (${group.parentGroup})`
    }
    return group.name
  }

  // Separate teams into unlinked and linked
  const unlinkedTeams = allTeams.filter(t => !t.spond_group_id && !teamMappings.has(t.id))
  const linkedOrPendingTeams = allTeams.filter(t => t.spond_group_id || teamMappings.has(t.id))

  // Get parent groups only (for first dropdown)
  const parentGroups = spondGroups.filter(g => g.isParentGroup)
  
  // Get subgroups for a specific parent group
  const getSubgroupsForParent = (parentGroupId: string) => {
    return spondGroups.filter(g => g.parentGroupId === parentGroupId && !g.isParentGroup)
  }

  // Handle parent group selection
  const handleParentGroupSelect = (teamId: number, parentGroupId: string) => {
    const newSelectedParent = new Map(selectedParentGroup)
    
    if (parentGroupId === 'none') {
      // Clear the selection
      newSelectedParent.delete(teamId)
      setSelectedParentGroup(newSelectedParent)
      // Also remove any mapping
      handleTeamMappingChange(teamId, 'none')
      return
    }
    
    newSelectedParent.set(teamId, parentGroupId)
    setSelectedParentGroup(newSelectedParent)
    
    // Check if this parent group has subgroups
    const subgroups = getSubgroupsForParent(parentGroupId)
    if (subgroups.length === 0) {
      // No subgroups, directly map to parent group
      handleTeamMappingChange(teamId, parentGroupId)
    } else {
      // Has subgroups, clear the mapping (user needs to select subgroup or confirm parent)
      // By default, we'll select the parent group itself
      handleTeamMappingChange(teamId, parentGroupId)
    }
  }

  // Handle subgroup selection (or selecting 'entire group')
  const handleSubgroupSelect = (teamId: number, subgroupId: string) => {
    const parentGroupId = selectedParentGroup.get(teamId)
    if (!parentGroupId) return
    
    if (subgroupId === 'entire-group') {
      // Map to the parent group itself
      handleTeamMappingChange(teamId, parentGroupId)
    } else {
      // Map to the subgroup
      handleTeamMappingChange(teamId, subgroupId)
    }
  }

  // Get the current subgroup selection for a team
  const getCurrentSubgroupSelection = (teamId: number): string => {
    const mapping = teamMappings.get(teamId)
    if (!mapping) return 'entire-group'
    
    const parentGroupId = selectedParentGroup.get(teamId)
    if (!parentGroupId) return 'entire-group'
    
    // Check if the mapping is to the parent group or a subgroup
    if (mapping.spondGroupId === parentGroupId) {
      return 'entire-group'
    }
    return mapping.spondGroupId
  }

  const renderSpondGroupSelect = (teamId: number, currentValue: string) => {
    // Find which parent group this current value belongs to
    const currentGroup = spondGroups.find(g => g.id === currentValue)
    const currentParentId = selectedParentGroup.get(teamId) || 
      (currentGroup?.isParentGroup ? currentGroup.id : currentGroup?.parentGroupId) || 
      ''
    const subgroups = currentParentId ? getSubgroupsForParent(currentParentId) : []
    const hasSubgroups = subgroups.length > 0
    
    return (
      <div className="flex flex-col gap-2 w-full">
        {/* Parent Group Dropdown */}
        <Select
          value={currentParentId || 'none'}
          onValueChange={(value) => handleParentGroupSelect(teamId, value)}
        >
          <SelectTrigger className="w-full bg-white text-sm h-9">
            <SelectValue placeholder="Select Spond group..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-gray-500">Don't link</span>
            </SelectItem>
            {parentGroups.map((group) => {
              const linkedCount = group.linkedTeams?.length || 0
              return (
                <SelectItem key={group.id} value={group.id}>
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{group.name}</span>
                    {group.memberCount > 0 && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        ({group.memberCount})
                      </span>
                    )}
                    {group.hasSubgroups && (
                      <span className="text-xs text-blue-600 bg-blue-100 px-1 py-0.5 rounded flex-shrink-0">
                        {getSubgroupsForParent(group.id).length}
                      </span>
                    )}
                    {linkedCount > 0 && (
                      <span className="text-xs text-green-600 bg-green-100 px-1 py-0.5 rounded flex-shrink-0">
                        {linkedCount} linked
                      </span>
                    )}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        
        {/* Subgroup Dropdown - only shown if parent group has subgroups */}
        {currentParentId && currentParentId !== 'none' && hasSubgroups && (
          <Select
            value={getCurrentSubgroupSelection(teamId)}
            onValueChange={(value) => handleSubgroupSelect(teamId, value)}
          >
            <SelectTrigger className="w-full bg-white text-sm h-9">
              <SelectValue placeholder="Select subgroup..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entire-group">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-blue-500 flex-shrink-0" />
                  <span className="font-medium">Entire group</span>
                </div>
              </SelectItem>
              <Separator className="my-1" />
              {subgroups.map((subgroup) => {
                const linkedCount = subgroup.linkedTeams?.length || 0
                return (
                  <SelectItem key={subgroup.id} value={subgroup.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">└</span>
                      <span className="truncate">{subgroup.name}</span>
                      {subgroup.memberCount > 0 && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          ({subgroup.memberCount})
                        </span>
                      )}
                      {linkedCount > 0 && (
                        <span className="text-xs text-green-600 bg-green-100 px-1 py-0.5 rounded flex-shrink-0">
                          {linkedCount}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )}
      </div>
    )
  }

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          <LinkSimple size={20} className="text-gray-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-medium">Link Your Teams</p>
            <p className="text-gray-500 mt-1">
              Connect your local teams to Spond groups or subgroups to sync events and attendance.
              You can skip this step and set up mappings later.
            </p>
          </div>
        </div>
      </div>

      {loadingGroups ? (
        <div className="flex items-center justify-center py-12">
          <ArrowsClockwise className="animate-spin text-gray-400" size={32} />
        </div>
      ) : (
        <>
          {/* Linked/Pending Teams Summary - Expandable */}
          {teamMappings.size > 0 && (
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowMappingSummary(!showMappingSummary)}
                className="w-full p-3 bg-green-50 hover:bg-green-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle size={16} weight="fill" />
                  <span className="font-medium">{teamMappings.size} team(s) linked to Spond groups</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <span className="text-xs">Click to {showMappingSummary ? 'collapse' : 'view & edit'}</span>
                  {showMappingSummary ? <CaretUp size={16} /> : <CaretDown size={16} />}
                </div>
              </button>
              
              {showMappingSummary && (
                <div className="bg-white border-t border-green-200 max-h-[300px] overflow-y-auto">
                  <div className="divide-y divide-gray-100">
                    {Array.from(teamMappings.values()).map((mapping) => {
                        const team = allTeams.find(t => t.id === mapping.teamId)
                        const isEditing = editingTeamId === mapping.teamId
                        
                        return (
                          <div
                            key={mapping.teamId}
                            className="p-3 hover:bg-gray-50 transition-colors"
                          >
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-gray-900 truncate">{mapping.teamName}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingTeamId(null)}
                                    className="h-7 w-7 p-0 flex-shrink-0"
                                  >
                                    <X size={14} />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                                  <div className="flex-1">
                                    {renderSpondGroupSelect(mapping.teamId, mapping.spondGroupId)}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 truncate">{mapping.teamName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <ArrowRight size={12} className="text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-600 truncate">
                                      {getSpondGroupName(mapping.spondGroupId)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingTeamId(mapping.teamId)}
                                    className="h-7 w-7 p-0 text-gray-500 hover:text-blue-600"
                                    title="Edit mapping"
                                  >
                                    <PencilSimple size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTeamMappingChange(mapping.teamId, 'none')}
                                    className="h-7 w-7 p-0 text-gray-500 hover:text-red-600"
                                    title="Remove link"
                                  >
                                    <LinkBreak size={14} />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                </div>
              )}
            </div>
          )}

          {/* Unlinked Teams */}
          <div className="max-h-[350px] overflow-y-auto pr-2">
            <div className="space-y-3">
              {unlinkedTeams.length === 0 && teamMappings.size === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users size={32} className="mx-auto mb-2 text-gray-300" />
                  <p>No teams found</p>
                  <p className="text-xs mt-1">Create teams first or import them from Spond.</p>
                </div>
              ) : unlinkedTeams.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
                  <p className="text-sm">All teams are linked!</p>
                  <p className="text-xs mt-1">Expand the section above to view or edit mappings.</p>
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1">
                    Unlinked Teams ({unlinkedTeams.length})
                  </div>
                  {unlinkedTeams.map((team) => (
                    <div
                      key={team.id}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      {/* Team name row */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-900 truncate">{team.name}</span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {team.sport}
                        </Badge>
                      </div>
                      
                      {/* Select row */}
                      <div className="flex items-center gap-2">
                        <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                        <div className="flex-1">
                          {renderSpondGroupSelect(team.id, 'none')}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )

  const stepInfo = renderStepTitle()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-gray-200 shadow-xl sm:max-w-lg max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${COLORS.ACCENT}, ${COLORS.NAVY})` }}
            >
              <Lightning size={18} weight="fill" className="text-white" />
            </div>
            {stepInfo.title}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {stepInfo.description}
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="overflow-y-auto">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
          {step > 1 && step !== 2 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={saving}
              className="border-gray-300"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          )}
          
          <div className="flex-1" />
          
          {step === 1 && (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-[#248bcc] hover:bg-[#1a6a9a] text-white"
            >
              Test Connection
              <ArrowRight size={16} className="ml-2" />
            </Button>
          )}
          
          {step === 2 && connectionTestResult?.success && (
            <Button
              onClick={handleNext}
              className="bg-[#248bcc] hover:bg-[#1a6a9a] text-white"
            >
              Continue to Team Mapping
              <ArrowRight size={16} className="ml-2" />
            </Button>
          )}
          
          {step === 3 && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setTeamMappings(new Map())
                  saveConfiguration()
                }}
                disabled={saving}
                className="border-gray-300"
              >
                Skip Mapping
              </Button>
              <Button
                onClick={saveConfiguration}
                disabled={saving}
                className="bg-[#248bcc] hover:bg-[#1a6a9a] text-white"
              >
                {saving ? (
                  <>
                    <ArrowsClockwise className="animate-spin mr-2" size={16} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} className="mr-2" />
                    {teamMappings.size > 0 ? 'Save & Link Teams' : 'Complete Setup'}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
