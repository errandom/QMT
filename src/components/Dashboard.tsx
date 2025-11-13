import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CalendarBlank, Cube, MapPin, ListBullets, Calendar, Football, Plus, Briefcase } from '@phosphor-icons/react'
import EventList from './EventList'
import ScheduleView from './ScheduleView'
import FacilityRequestDialog from './FacilityRequestDialog'
import EquipmentRequestDialog from './EquipmentRequestDialog'
import LoginDialog from './LoginDialog'
import FootballHelmetIcon from './FootballHelmetIcon'
import { User, SportType } from '@/lib/types'
import { useKV } from '@github/spark/hooks'
import { hasAccess } from '@/lib/auth'

interface DashboardProps {
  currentUser: User | null
  onLogin?: (user: User) => void
  onNavigateToOffice?: () => void
}

export default function Dashboard({ currentUser, onLogin, onNavigateToOffice }: DashboardProps) {
  const [sportFilter, setSportFilter] = useState<'All Sports' | SportType>('All Sports')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'schedule'>('list')
  const [showFacilityDialog, setShowFacilityDialog] = useState(false)
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [teams] = useKV('teams', [])

  const handleOfficeClick = () => {
    if (currentUser && hasAccess(currentUser)) {
      onNavigateToOffice?.()
    } else {
      setShowLoginDialog(true)
    }
  }

  const handleLoginSuccess = (user: User) => {
    onLogin?.(user)
    setShowLoginDialog(false)
    if (hasAccess(user)) {
      onNavigateToOffice?.()
    }
  }

  const filteredTeams = teams.filter((team: any) => {
    if (sportFilter === 'All Sports') return team.isActive
    return team.isActive && team.sportType === sportFilter
  })

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-4">
          <Tabs value={sportFilter} onValueChange={(v) => setSportFilter(v as any)} className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-14">
              <TabsTrigger value="All Sports" className="h-full">
                <FootballHelmetIcon className="mr-2" size={18} />
                <Football className="mr-2" size={18} />
                All Sports
              </TabsTrigger>
              <TabsTrigger value="Tackle Football" className="h-full">
                <FootballHelmetIcon className="mr-2" size={18} />
                Tackle Football
              </TabsTrigger>
              <TabsTrigger value="Flag Football" className="h-full">
                <Football className="mr-2" size={18} />
                Flag Football
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {sportFilter !== 'All Sports' && filteredTeams.length > 0 && (
                    <>
                      <SelectItem value="divider" disabled className="text-xs font-semibold text-muted-foreground">
                        {sportFilter}
                      </SelectItem>
                      {filteredTeams.map((team: any) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {sportFilter === 'All Sports' && (
                    <>
                      {teams.filter((t: any) => t.isActive && t.sportType === 'Tackle Football').length > 0 && (
                        <>
                          <SelectItem value="tackle-divider" disabled className="text-xs font-semibold text-muted-foreground">
                            Tackle Football
                          </SelectItem>
                          {teams.filter((t: any) => t.isActive && t.sportType === 'Tackle Football').map((team: any) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {teams.filter((t: any) => t.isActive && t.sportType === 'Flag Football').length > 0 && (
                        <>
                          <SelectItem value="flag-divider" disabled className="text-xs font-semibold text-muted-foreground">
                            Flag Football
                          </SelectItem>
                          {teams.filter((t: any) => t.isActive && t.sportType === 'Flag Football').map((team: any) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button onClick={() => setShowFacilityDialog(true)} variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Plus className="mr-2" size={16} />
                  <MapPin className="mr-2" size={16} />
                  Facility
                </Button>
                <Button onClick={() => setShowEquipmentDialog(true)} variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Plus className="mr-2" size={16} />
                  <Cube className="mr-2" size={16} />
                  Equipment
                </Button>
                <Button onClick={handleOfficeClick} variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Briefcase className="mr-2" size={16} />
                  Operations Office
                </Button>
              </div>
            </div>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full sm:w-auto">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="list" className="flex-1 sm:flex-none">
                  <ListBullets className="mr-2" size={16} />
                  List
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex-1 sm:flex-none">
                  <Calendar className="mr-2" size={16} />
                  Schedule
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Upcoming Events</h2>
          {viewMode === 'list' ? (
            <EventList sportFilter={sportFilter} teamFilter={teamFilter} />
          ) : (
            <ScheduleView sportFilter={sportFilter} teamFilter={teamFilter} />
          )}
        </div>
      </div>

      <FacilityRequestDialog
        open={showFacilityDialog}
        onOpenChange={setShowFacilityDialog}
      />

      <EquipmentRequestDialog
        open={showEquipmentDialog}
        onOpenChange={setShowEquipmentDialog}
      />

      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  )
}