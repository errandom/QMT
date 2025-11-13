import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Cube, MapPin, ListBullets, Calendar, Football, Plus, Briefcase } from '@phosphor-icons/react'
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

  const sportOptions = [
    { value: 'All Sports', label: 'All Sports', icon: <Football size={28} weight="duotone" />, iconAlt: <FootballHelmetIcon size={28} /> },
    { value: 'Tackle Football', label: 'Tackle Football', icon: <FootballHelmetIcon size={28} /> },
    { value: 'Flag Football', label: 'Flag Football', icon: <Football size={28} weight="duotone" /> }
  ]

  const activeIndex = sportOptions.findIndex(opt => opt.value === sportFilter)

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="relative w-full h-24 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-1.5 shadow-2xl shadow-purple-500/40">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-60" style={{ mixBlendMode: 'overlay' }} />
            <div className="absolute inset-0 rounded-2xl backdrop-blur-3xl bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30" />
            
            <div className="relative h-full rounded-xl bg-gradient-to-br from-slate-900/40 to-slate-900/60 backdrop-blur-sm p-1.5">
              <div className="relative grid grid-cols-3 gap-2 h-full">
                <div 
                  className="absolute top-0 bottom-0 bg-white rounded-lg shadow-xl shadow-black/30 transition-all duration-300 ease-out"
                  style={{
                    left: `calc(${activeIndex * 33.333}% + ${activeIndex * 0.5}rem)`,
                    width: 'calc(33.333% - 0.333rem)',
                  }}
                />
                
                {sportOptions.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => setSportFilter(option.value as any)}
                    className={`relative z-10 flex flex-col items-center justify-center gap-1 rounded-lg transition-all duration-300 ${
                      sportFilter === option.value 
                        ? 'text-slate-900' 
                        : 'text-white/90 hover:text-white hover:scale-105'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {option.iconAlt || option.icon}
                      {option.iconAlt && option.icon}
                    </div>
                    <span className="text-sm font-bold tracking-tight">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

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