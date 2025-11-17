import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Cube, MapPin, ListBullets, Calendar, Football, FootballHelmet, Plus, Briefcase } from '@phosphor-icons/react'
import EventList from './EventList'
import ScheduleView from './ScheduleView'
import FacilityRequestDialog from './FacilityRequestDialog'
import EquipmentRequestDialog from './EquipmentRequestDialog'
import LoginDialog from './LoginDialog'
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
    { 
      value: 'All Sports', 
      label: 'All Sports', 
      icon: (
        <div className="flex items-center gap-1">
          <FootballHelmet size={28} weight="duotone" />
          <Football size={28} weight="duotone" />
        </div>
      ),
      mobileIcon: (
        <div className="flex items-center gap-1">
          <FootballHelmet size={28} weight="duotone" />
          <Football size={28} weight="duotone" />
        </div>
      )
    },
    { 
      value: 'Tackle Football', 
      label: 'Tackle Football', 
      icon: <FootballHelmet size={28} weight="duotone" />,
      mobileIcon: <FootballHelmet size={28} weight="duotone" />
    },
    { 
      value: 'Flag Football', 
      label: 'Flag Football', 
      icon: <Football size={28} weight="duotone" />,
      mobileIcon: <Football size={28} weight="duotone" />
    }
  ]

  const activeIndex = sportOptions.findIndex(opt => opt.value === sportFilter)

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-6">
          <div className="relative w-full h-20 px-1.5 py-0.5" style={{ borderRadius: '8pt' }}>
            
            <div className="relative h-full backdrop-blur-sm px-2 py-1 shadow-inner" style={{
              background: '#3e4347',
              borderRadius: '8pt'
            }}>
              <div className="relative grid grid-cols-3 gap-2 h-full">
                <div 
                  className="absolute shadow-xl shadow-black/30 transition-all duration-300 ease-out"
                  style={{
                    left: `calc(${activeIndex * 33.333}% + 0.5rem)`,
                    top: '0.125rem',
                    bottom: '0.125rem',
                    width: 'calc(33.333% - 1rem)',
                    background: 'rgba(36, 139, 204, 0.75)',
                    boxShadow: '0 8px 32px rgba(36, 139, 204, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                    borderRadius: '8pt'
                  }}
                />
                
                {sportOptions.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => setSportFilter(option.value as any)}
                    className={`group relative z-10 flex flex-col items-center justify-center gap-0.5 transition-all duration-300 ${
                      sportFilter === option.value 
                        ? 'drop-shadow-lg' 
                        : 'opacity-70 hover:opacity-90'
                    }`}
                    style={{ color: '#f5f5f5', borderRadius: '8pt' }}
                  >
                    <div className="flex flex-col items-center gap-0.5 group-hover:scale-110 transition-transform duration-200">
                      <span>{option.mobileIcon}</span>
                      <span className="text-sm font-bold tracking-tight hidden md:inline">{option.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="group w-full lg:w-[240px] border-white/20 text-white hover:shadow-[0_0_20px_rgba(0,31,63,0.8)] transition-all" style={{ borderRadius: '8pt', height: '40px', minHeight: '40px', maxHeight: '40px', background: '#001f3f', boxShadow: '0 0 15px rgba(0, 31, 63, 0.6)', fontSize: '0.875rem' }}>
                <div className="group-hover:scale-110 transition-transform duration-200">
                  <SelectValue placeholder="All Teams" />
                </div>
              </SelectTrigger>
              <SelectContent className="glass-card border-white/20">
                <SelectItem value="all" className="text-foreground">All Teams</SelectItem>
                {sportFilter !== 'All Sports' && filteredTeams.length > 0 && (
                  <>
                    <SelectItem value="divider" disabled className="text-xs font-semibold" style={{ color: '#248bbc' }}>
                      {sportFilter}
                    </SelectItem>
                    {filteredTeams.map((team: any) => (
                      <SelectItem key={team.id} value={team.id} className="text-foreground">
                        {team.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {sportFilter === 'All Sports' && (
                  <>
                    {(teams || []).filter((t: any) => t.isActive && t.sportType === 'Tackle Football').length > 0 && (
                      <>
                        <SelectItem value="tackle-divider" disabled className="text-xs font-semibold" style={{ color: '#248bbc' }}>
                          Tackle Football
                        </SelectItem>
                        {(teams || []).filter((t: any) => t.isActive && t.sportType === 'Tackle Football').map((team: any) => (
                          <SelectItem key={team.id} value={team.id} className="text-foreground">
                            {team.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {(teams || []).filter((t: any) => t.isActive && t.sportType === 'Flag Football').length > 0 && (
                      <>
                        <SelectItem value="flag-divider" disabled className="text-xs font-semibold" style={{ color: '#248bbc' }}>
                          Flag Football
                        </SelectItem>
                        {(teams || []).filter((t: any) => t.isActive && t.sportType === 'Flag Football').map((team: any) => (
                          <SelectItem key={team.id} value={team.id} className="text-foreground">
                            {team.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </>
                )}
              </SelectContent>
            </Select>

            <div className="flex gap-2 flex-1">
              <Button onClick={() => setShowFacilityDialog(true)} className="group flex-1 h-10 border-white/20 transition-all text-white text-sm hover:shadow-[0_0_20px_rgba(0,31,63,0.8)]" style={{ borderRadius: '8pt', background: '#001f3f', boxShadow: '0 0 15px rgba(0, 31, 63, 0.6)', fontSize: '0.875rem' }}>
                <div className="flex items-center group-hover:scale-110 transition-transform duration-200">
                  <Plus className="mr-2" size={18} weight="bold" />
                  <MapPin className="mr-2 hidden md:inline" size={18} weight="duotone" />
                  <span>Facility</span>
                </div>
              </Button>
              <Button onClick={() => setShowEquipmentDialog(true)} className="group flex-1 h-10 border-white/20 transition-all text-white text-sm hover:shadow-[0_0_20px_rgba(0,31,63,0.8)]" style={{ borderRadius: '8pt', background: '#001f3f', boxShadow: '0 0 15px rgba(0, 31, 63, 0.6)', fontSize: '0.875rem' }}>
                <div className="flex items-center group-hover:scale-110 transition-transform duration-200">
                  <Plus className="mr-2" size={18} weight="bold" />
                  <Cube className="mr-2 hidden md:inline" size={18} weight="duotone" />
                  <span>Equipment</span>
                </div>
              </Button>
              <Button onClick={handleOfficeClick} className="group flex-1 h-10 border-white/20 transition-all text-white text-sm hover:shadow-[0_0_20px_rgba(62,67,71,0.8)]" style={{ borderRadius: '8pt', background: '#3e4347', boxShadow: '0 0 15px rgba(62, 67, 71, 0.6)', fontSize: '0.875rem' }}>
                <div className="flex items-center group-hover:scale-110 transition-transform duration-200">
                  <Briefcase className="mr-2 hidden md:inline" size={18} weight="duotone" />
                  <span>Office</span>
                </div>
              </Button>
            </div>

            <div className="relative w-full lg:w-[260px] h-10 backdrop-blur-sm" style={{
              borderRadius: '8pt',
              background: '#001f3f',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
              padding: '2px 4px'
            }}>
              <div className="relative w-full h-full flex gap-1">
                <div 
                  className="absolute shadow-xl shadow-black/30 transition-all duration-300 ease-out"
                  style={{
                    left: viewMode === 'list' ? '4px' : 'calc(50% + 4px)',
                    top: '2px',
                    bottom: '2px',
                    width: 'calc(50% - 8px)',
                    borderRadius: '8pt',
                    background: 'rgba(36, 139, 204, 0.75)',
                    boxShadow: '0 8px 32px rgba(36, 139, 204, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                  }}
                />
                
                <button
                  onClick={() => setViewMode('list')}
                  className={`group relative z-10 flex-1 flex items-center justify-center gap-2 transition-all duration-300 ${
                    viewMode === 'list' 
                      ? 'drop-shadow-lg' 
                      : 'opacity-70 hover:opacity-90'
                  }`}
                  style={{ color: '#f5f5f5', borderRadius: '8pt' }}
                >
                  <div className="flex items-center gap-2 group-hover:scale-110 transition-transform duration-200">
                    <ListBullets size={18} weight="duotone" />
                    <span className="font-bold text-sm">List</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setViewMode('schedule')}
                  className={`group relative z-10 flex-1 flex items-center justify-center gap-2 transition-all duration-300 ${
                    viewMode === 'schedule' 
                      ? 'drop-shadow-lg' 
                      : 'opacity-70 hover:opacity-90'
                  }`}
                  style={{ color: '#f5f5f5', borderRadius: '8pt' }}
                >
                  <div className="flex items-center gap-2 group-hover:scale-110 transition-transform duration-200">
                    <Calendar size={18} weight="duotone" />
                    <span className="font-bold text-sm">Schedule</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 drop-shadow-lg" style={{ color: '#001f3f' }}>Upcoming Events</h2>
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