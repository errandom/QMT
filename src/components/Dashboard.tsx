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
  const [teams] = useKV<any[]>('teams', [])

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

  const filteredTeams = (teams || []).filter((team: any) => {
    if (sportFilter === 'All Sports') return team.isActive
    return team.isActive && team.sportType === sportFilter
  })

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-4">
          <Tabs value={sportFilter} onValueChange={(v) => setSportFilter(v as any)} className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-20 gap-3 bg-transparent p-0">
              <TabsTrigger 
                value="All Sports" 
                className="h-full text-base font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:via-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/50 bg-gradient-to-br from-muted/80 to-muted hover:from-muted hover:to-muted/90 transition-all duration-200 data-[state=active]:scale-[1.02] backdrop-blur-sm"
              >
                <FootballHelmetIcon className="mr-2" size={28} />
                <Football className="mr-2" size={28} weight="duotone" />
                All Sports
              </TabsTrigger>
              <TabsTrigger 
                value="Tackle Football" 
                className="h-full text-base font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:via-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/50 bg-gradient-to-br from-muted/80 to-muted hover:from-muted hover:to-muted/90 transition-all duration-200 data-[state=active]:scale-[1.02] backdrop-blur-sm"
              >
                <FootballHelmetIcon className="mr-2" size={28} />
                Tackle Football
              </TabsTrigger>
              <TabsTrigger 
                value="Flag Football" 
                className="h-full text-base font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:via-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/50 bg-gradient-to-br from-muted/80 to-muted hover:from-muted hover:to-muted/90 transition-all duration-200 data-[state=active]:scale-[1.02] backdrop-blur-sm"
              >
                <Football className="mr-2" size={28} weight="duotone" />
                Flag Football
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-full sm:w-[240px] h-10">
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
                    {(teams || []).filter((t: any) => t.isActive && t.sportType === 'Tackle Football').length > 0 && (
                      <>
                        <SelectItem value="tackle-divider" disabled className="text-xs font-semibold text-muted-foreground">
                          Tackle Football
                        </SelectItem>
                        {(teams || []).filter((t: any) => t.isActive && t.sportType === 'Tackle Football').map((team: any) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {(teams || []).filter((t: any) => t.isActive && t.sportType === 'Flag Football').length > 0 && (
                      <>
                        <SelectItem value="flag-divider" disabled className="text-xs font-semibold text-muted-foreground">
                          Flag Football
                        </SelectItem>
                        {(teams || []).filter((t: any) => t.isActive && t.sportType === 'Flag Football').map((team: any) => (
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

            <div className="flex gap-2 flex-1 sm:flex-none">
              <Button onClick={() => setShowFacilityDialog(true)} variant="outline" className="flex-1 h-10 sm:min-w-[140px]">
                <Plus className="mr-2" size={18} weight="bold" />
                <MapPin className="mr-2" size={18} weight="duotone" />
                Facility
              </Button>
              <Button onClick={() => setShowEquipmentDialog(true)} variant="outline" className="flex-1 h-10 sm:min-w-[140px]">
                <Plus className="mr-2" size={18} weight="bold" />
                <Cube className="mr-2" size={18} weight="duotone" />
                Equipment
              </Button>
              <Button onClick={handleOfficeClick} variant="outline" className="flex-1 h-10 sm:min-w-[160px]">
                <Briefcase className="mr-2" size={18} weight="duotone" />
                Office
              </Button>
            </div>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full sm:w-auto">
              <TabsList className="w-full sm:w-auto h-10">
                <TabsTrigger value="list" className="flex-1 sm:flex-none h-9">
                  <ListBullets className="mr-2" size={18} weight="duotone" />
                  List
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex-1 sm:flex-none h-9">
                  <Calendar className="mr-2" size={18} weight="duotone" />
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