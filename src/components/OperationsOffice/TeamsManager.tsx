import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { Team, SportType, RosterSize, User } from '@/lib/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, PencilSimple, Users, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { COLORS } from '@/lib/constants'

interface TeamsManagerProps {
  currentUser: User | null
}

export default function TeamsManager({ currentUser }: TeamsManagerProps) {
  const { teams, setTeams } = useData()
  const [showDialog, setShowDialog] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)

  const [formData, setFormData] = useState<Partial<Team>>({
    name: '',
    sportType: 'Tackle Football',
    headCoach: undefined,
    teamManager: undefined,
    rosterSize: undefined,
    isActive: true
  })

  const handleCreate = () => {
    setEditingTeam(null)
    setFormData({
      name: '',
      sportType: 'Tackle Football',
      headCoach: undefined,
      teamManager: undefined,
      rosterSize: undefined,
      isActive: true
    })
    setShowDialog(true)
  }

  const handleEdit = (team: Team) => {
    setEditingTeam(team)
    setFormData(team)
    setShowDialog(true)
  }

  const handleDelete = async (teamId: string) => {
    if (confirm('Are you sure you want to delete this team?')) {
      try {
        const numericId = parseInt(teamId)
        if (!isNaN(numericId)) {
          await api.deleteTeam(numericId)
        }
        setTeams((current = []) => current.filter(t => t.id !== teamId))
        toast.success('Team deleted successfully')
      } catch (error: any) {
        console.error('Error deleting team:', error)
        toast.error(error.message || 'Failed to delete team')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (!formData.name) {
        toast.error('Team name is required')
        return
      }

      // Map form data to API format
      const apiData = {
        name: formData.name,
        sport: formData.sportType,
        age_group: formData.rosterSize || null,
        coaches: formData.headCoach ? `${formData.headCoach.firstName} ${formData.headCoach.lastName}` : null,
        active: formData.isActive
      }

      if (editingTeam) {
        // Update existing team
        const numericId = parseInt(editingTeam.id)
        if (!isNaN(numericId)) {
          await api.updateTeam(numericId, apiData)
          setTeams((current = []) =>
            current.map(t => t.id === editingTeam.id ? { ...formData, id: editingTeam.id } as Team : t)
          )
          toast.success('Team updated successfully')
        } else {
          // For non-numeric IDs, just update in memory
          setTeams((current = []) =>
            current.map(t => t.id === editingTeam.id ? { ...formData, id: editingTeam.id } as Team : t)
          )
          toast.success('Team updated successfully')
        }
      } else {
        // Create new team
        const response = await api.createTeam(apiData)
        const newTeam: Team = {
          ...formData,
          id: response.id?.toString() || `team-${Date.now()}`
        } as Team
        
        setTeams((current = []) => [...current, newTeam])
        toast.success('Team created successfully')
      }
      
      setShowDialog(false)
    } catch (error: any) {
      console.error('Error saving team:', error)
      toast.error(error.message || 'Failed to save team')
    }
  }

  const handleToggleActive = async (teamId: string, currentActive: boolean) => {
    try {
      const team = teams.find(t => t.id === teamId)
      if (!team) return

      const numericId = parseInt(teamId)
      if (!isNaN(numericId)) {
        const apiData = {
          name: team.name,
          sport: team.sportType,
          age_group: team.rosterSize || null,
          coaches: team.headCoach ? `${team.headCoach.firstName} ${team.headCoach.lastName}` : null,
          active: !currentActive
        }
        await api.updateTeam(numericId, apiData)
      }
      
      setTeams((current = []) =>
        current.map(t => t.id === teamId ? { ...t, isActive: !currentActive } : t)
      )
      toast.success(`Team ${currentActive ? 'deactivated' : 'activated'} successfully`)
    } catch (error: any) {
      console.error('Error toggling team status:', error)
      toast.error(error.message || 'Failed to update team status')
    }
  }

  const tackleTeams = teams.filter(t => t.sportType === 'Tackle Football')
  const flagTeams = teams.filter(t => t.sportType === 'Flag Football')

  const renderTeamCard = (team: Team) => (
    <Card key={team.id} className={!team.isActive ? 'opacity-60' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2" style={{ color: COLORS.NAVY }}>
              <Users size={16} />
              {team.name}
            </CardTitle>
            <Badge variant={team.isActive ? 'default' : 'destructive'} className="text-xs">
              {team.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {currentUser && (currentUser.role === 'admin' || currentUser.role === 'mgmt') && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#248bcc] hover:text-[#248bcc] hover:bg-[#248bcc]/10"
                onClick={() => handleEdit(team)}
                title="Edit team"
              >
                <PencilSimple size={18} weight="bold" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(team.id)}
                title="Delete team"
              >
                <Trash size={18} weight="bold" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {team.rosterSize && (
          <div className="text-xs" style={{ color: COLORS.CHARCOAL }}>
            <span className="text-muted-foreground">Roster: </span>
            {team.rosterSize}
          </div>
        )}
        {team.headCoach && (
          <div className="text-xs" style={{ color: COLORS.CHARCOAL }}>
            <span className="text-muted-foreground">Coach: </span>
            {team.headCoach.firstName} {team.headCoach.lastName}
          </div>
        )}
        {team.teamManager && (
          <div className="text-xs" style={{ color: COLORS.CHARCOAL }}>
            <span className="text-muted-foreground">Manager: </span>
            {team.teamManager.firstName} {team.teamManager.lastName}
          </div>
        )}
        {currentUser && (currentUser.role === 'admin' || currentUser.role === 'mgmt') && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs font-medium" style={{ color: COLORS.CHARCOAL }}>Status</span>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: COLORS.CHARCOAL }}>
                {team.isActive ? 'Active' : 'Inactive'}
              </span>
              <Switch
                checked={team.isActive}
                onCheckedChange={() => handleToggleActive(team.id, team.isActive)}
                style={{
                  backgroundColor: team.isActive ? COLORS.NAVY : undefined
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Teams Management</h2>
        <Button onClick={handleCreate}>
          <Plus className="mr-2" size={16} />
          Add Team
        </Button>
      </div>

      {tackleTeams.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Tackle Football</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tackleTeams.map(renderTeamCard)}
          </div>
        </div>
      )}

      {flagTeams.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Flag Football</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flagTeams.map(renderTeamCard)}
          </div>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto operations-dialog"
          style={{
            background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)',
            border: `3px solid ${COLORS.NAVY}`,
            boxShadow: '0 20px 60px rgba(0, 31, 63, 0.3)'
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: COLORS.NAVY }}>
              {editingTeam ? 'Edit Team' : 'Create Team'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" style={{ color: COLORS.CHARCOAL }}>Team Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sportType" style={{ color: COLORS.CHARCOAL }}>Sport Type *</Label>
                <Select 
                  value={formData.sportType || 'Tackle Football'} 
                  onValueChange={(v) => setFormData({ ...formData, sportType: v as SportType })}
                >
                  <SelectTrigger id="sportType" style={{ color: COLORS.CHARCOAL }}>
                    <SelectValue placeholder="Select sport type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tackle Football">Tackle Football</SelectItem>
                    <SelectItem value="Flag Football">Flag Football</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rosterSize" style={{ color: COLORS.CHARCOAL }}>Roster Size</Label>
              <Select 
                value={formData.rosterSize} 
                onValueChange={(v) => setFormData({ ...formData, rosterSize: v as RosterSize })}
              >
                <SelectTrigger id="rosterSize" style={{ color: COLORS.CHARCOAL }}>
                  <SelectValue placeholder="Select roster size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="< 15">Less than 15</SelectItem>
                  <SelectItem value="16-30">16-30</SelectItem>
                  <SelectItem value="> 30">More than 30</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label style={{ color: COLORS.CHARCOAL }}>Head Coach (optional)</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="First Name"
                  value={formData.headCoach?.firstName || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    headCoach: { ...formData.headCoach!, firstName: e.target.value }
                  })}
                  style={{ color: COLORS.CHARCOAL }}
                />
                <Input
                  placeholder="Last Name"
                  value={formData.headCoach?.lastName || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    headCoach: { ...formData.headCoach!, lastName: e.target.value }
                  })}
                  style={{ color: COLORS.CHARCOAL }}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={formData.headCoach?.email || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    headCoach: { ...formData.headCoach!, email: e.target.value }
                  })}
                  style={{ color: COLORS.CHARCOAL }}
                />
                <Input
                  placeholder="Phone"
                  type="tel"
                  value={formData.headCoach?.phone || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    headCoach: { ...formData.headCoach!, phone: e.target.value }
                  })}
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label style={{ color: COLORS.CHARCOAL }}>Team Manager (optional)</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="First Name"
                  value={formData.teamManager?.firstName || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    teamManager: { ...formData.teamManager!, firstName: e.target.value }
                  })}
                  style={{ color: COLORS.CHARCOAL }}
                />
                <Input
                  placeholder="Last Name"
                  value={formData.teamManager?.lastName || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    teamManager: { ...formData.teamManager!, lastName: e.target.value }
                  })}
                  style={{ color: COLORS.CHARCOAL }}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={formData.teamManager?.email || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    teamManager: { ...formData.teamManager!, email: e.target.value }
                  })}
                  style={{ color: COLORS.CHARCOAL }}
                />
                <Input
                  placeholder="Phone"
                  type="tel"
                  value={formData.teamManager?.phone || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    teamManager: { ...formData.teamManager!, phone: e.target.value }
                  })}
                  style={{ color: COLORS.CHARCOAL }}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                style={{
                  backgroundColor: formData.isActive ? COLORS.NAVY : undefined
                }}
              />
              <Label htmlFor="isActive" style={{ color: COLORS.CHARCOAL }}>Active</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowDialog(false)}
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
                style={{
                  backgroundColor: COLORS.ACCENT,
                  color: 'white',
                  border: 'none'
                }}
              >
                {editingTeam ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
