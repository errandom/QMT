import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react';
import { useTeams } from '@/hooks/use-data';
import { Team, SportType } from '@/lib/types';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export function TeamsTable() {
  const [teams, setTeams] = useTeams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sportType: 'tackle' as SportType,
    isActive: true,
    headCoachName: '',
    headCoachEmail: '',
    headCoachPhone: '',
    teamManagerName: '',
    teamManagerEmail: '',
    teamManagerPhone: ''
  });

  const handleOpenDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        sportType: team.sportType,
        isActive: team.isActive,
        headCoachName: team.headCoachName || '',
        headCoachEmail: team.headCoachEmail || '',
        headCoachPhone: team.headCoachPhone || '',
        teamManagerName: team.teamManagerName || '',
        teamManagerEmail: team.teamManagerEmail || '',
        teamManagerPhone: team.teamManagerPhone || ''
      });
    } else {
      setEditingTeam(null);
      setFormData({
        name: '',
        sportType: 'tackle',
        isActive: true,
        headCoachName: '',
        headCoachEmail: '',
        headCoachPhone: '',
        teamManagerName: '',
        teamManagerEmail: '',
        teamManagerPhone: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTeam) {
      setTeams((current) =>
        (current || []).map(t =>
          t.id === editingTeam.id
            ? { ...t, ...formData }
            : t
        )
      );
      toast.success('Team updated successfully');
    } else {
      const newTeam: Team = {
        id: `team-${Date.now()}`,
        ...formData
      };
      setTeams((current) => [...(current || []), newTeam]);
      toast.success('Team created successfully');
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this team?')) {
      setTeams((current) => (current || []).filter(t => t.id !== id));
      toast.success('Team deleted successfully');
    }
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    setTeams((current) =>
      (current || []).map(t =>
        t.id === id
          ? { ...t, isActive: !currentActive }
          : t
      )
    );
    toast.success(`Team ${currentActive ? 'deactivated' : 'activated'} successfully`);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Teams</CardTitle>
              <CardDescription>Manage football teams</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus size={18} weight="duotone" />
              Add Team
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teams && teams.length > 0 ? (
              teams.map(team => (
                <Card key={team.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold">{team.name}</h3>
                          <Badge 
                            className={`font-semibold text-white ${
                              team.sportType === 'tackle' ? 'bg-orange-600' : 
                              team.sportType === 'all sports' ? 'bg-teal-600' : 
                              'bg-pink-600'
                            }`}
                          >
                            {team.sportType}
                          </Badge>
                          <Badge className={`font-semibold text-white ${team.isActive ? 'bg-green-600' : 'bg-gray-500'}`}>
                            {team.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {team.headCoachName && (
                            <div className="space-y-1">
                              <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Head Coach</div>
                              <div>{team.headCoachName}</div>
                              {team.headCoachEmail && <div className="text-muted-foreground">{team.headCoachEmail}</div>}
                              {team.headCoachPhone && <div className="text-muted-foreground">{team.headCoachPhone}</div>}
                            </div>
                          )}
                          
                          {team.teamManagerName && (
                            <div className="space-y-1">
                              <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Team Manager</div>
                              <div>{team.teamManagerName}</div>
                              {team.teamManagerEmail && <div className="text-muted-foreground">{team.teamManagerEmail}</div>}
                              {team.teamManagerPhone && <div className="text-muted-foreground">{team.teamManagerPhone}</div>}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 lg:flex-col lg:items-end">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`active-${team.id}`} className="text-xs">Active</Label>
                          <Switch
                            id={`active-${team.id}`}
                            checked={team.isActive}
                            onCheckedChange={() => handleToggleActive(team.id, team.isActive)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(team)}
                            className="gap-1"
                          >
                            <PencilSimple size={16} weight="duotone" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(team.id)}
                            className="gap-1"
                          >
                            <Trash size={16} weight="duotone" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No teams found. Click "Add Team" to create one.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Edit Team' : 'Add New Team'}</DialogTitle>
            <DialogDescription>
              {editingTeam ? 'Update team information' : 'Create a new team'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Team Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sportType">Sport Type *</Label>
                <Select value={formData.sportType} onValueChange={(value: SportType) => setFormData(prev => ({ ...prev, sportType: value }))}>
                  <SelectTrigger id="sportType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tackle">Tackle</SelectItem>
                    <SelectItem value="flag">Flag</SelectItem>
                    <SelectItem value="all sports">All Sports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Team is Active</Label>
            </div>

            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold text-sm uppercase tracking-wide">Head Coach</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headCoachName">Name</Label>
                  <Input
                    id="headCoachName"
                    value={formData.headCoachName}
                    onChange={(e) => setFormData(prev => ({ ...prev, headCoachName: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="headCoachEmail">Email</Label>
                    <Input
                      id="headCoachEmail"
                      type="email"
                      value={formData.headCoachEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, headCoachEmail: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="headCoachPhone">Phone</Label>
                    <Input
                      id="headCoachPhone"
                      type="tel"
                      value={formData.headCoachPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, headCoachPhone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold text-sm uppercase tracking-wide">Team Manager</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="teamManagerName">Name</Label>
                  <Input
                    id="teamManagerName"
                    value={formData.teamManagerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, teamManagerName: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamManagerEmail">Email</Label>
                    <Input
                      id="teamManagerEmail"
                      type="email"
                      value={formData.teamManagerEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, teamManagerEmail: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teamManagerPhone">Phone</Label>
                    <Input
                      id="teamManagerPhone"
                      type="tel"
                      value={formData.teamManagerPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, teamManagerPhone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingTeam ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
