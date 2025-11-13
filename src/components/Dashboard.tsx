import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CalendarBlank, Cube, MapPin, ListBullets, Calendar } from '@phosphor-icons/react'
import EventList from './EventList'
import ScheduleView from './ScheduleView'
import FacilityRequestDialog from './FacilityRequestDialog'
import EquipmentRequestDialog from './EquipmentRequestDialog'
import { User, SportType } from '@/lib/types'
import { useKV } from '@github/spark/hooks'

interface DashboardProps {
  currentUser: User | null
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const [sportFilter, setSportFilter] = useState<'All Sports' | SportType>('All Sports')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'schedule'>('list')
  const [showFacilityDialog, setShowFacilityDialog] = useState(false)
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false)
  const [teams] = useKV('teams', [])

  const filteredTeams = teams.filter((team: any) => {
    if (sportFilter === 'All Sports') return team.isActive
    return team.isActive && team.sportType === sportFilter
  })

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
            <Tabs value={sportFilter} onValueChange={(v) => setSportFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="All Sports">All Sports</TabsTrigger>
                <TabsTrigger value="Tackle Football">Tackle</TabsTrigger>
                <TabsTrigger value="Flag Football">Flag</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[200px]">
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
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowFacilityDialog(true)} variant="outline" size="sm">
              <MapPin className="mr-2" size={16} />
              Facility
            </Button>
            <Button onClick={() => setShowEquipmentDialog(true)} variant="outline" size="sm">
              <Cube className="mr-2" size={16} />
              Equipment
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Upcoming Events</h2>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="list">
                <ListBullets className="mr-2" size={16} />
                List
              </TabsTrigger>
              <TabsTrigger value="schedule">
                <Calendar className="mr-2" size={16} />
                Schedule
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {viewMode === 'list' ? (
          <EventList sportFilter={sportFilter} teamFilter={teamFilter} />
        ) : (
          <ScheduleView sportFilter={sportFilter} teamFilter={teamFilter} />
        )}
      </div>

      <FacilityRequestDialog
        open={showFacilityDialog}
        onOpenChange={setShowFacilityDialog}
      />

      <EquipmentRequestDialog
        open={showEquipmentDialog}
        onOpenChange={setShowEquipmentDialog}
      />
    </>
  )
}