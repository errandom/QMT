import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { 
  MapPin, 
  Users, 
  Clock, 
  CalendarBlank,
  Prohibit,
  CarSimple,
  Toilet,
  Lockers,
  Shower,
  ForkKnife,
  Package,
  Lightning,
  Plant
} from '@phosphor-icons/react'
import { Event, Team, Field, Site } from '@/lib/types'
import { toast } from 'sonner'

interface EventCardProps {
  event: Event
  teams: Team[]
  fields: Field[]
  sites: Site[]
}

const eventTypeColors = {
  'Game': 'bg-accent text-accent-foreground',
  'Practice': 'bg-secondary text-secondary-foreground',
  'Meeting': 'bg-muted text-muted-foreground',
  'Other': 'bg-muted text-muted-foreground'
}

const statusColors = {
  'Planned': 'bg-yellow-500 text-white',
  'Confirmed': 'bg-green-600 text-white',
  'Cancelled': 'bg-destructive text-destructive-foreground'
}

export default function EventCard({ event, teams, fields, sites }: EventCardProps) {
  const field = fields.find(f => f.id === event.fieldId)
  const site = field ? sites.find(s => s.id === field.siteId) : undefined
  const eventTeams = event.teamIds ? teams.filter(t => event.teamIds.includes(t.id)) : []
  
  const eventDate = new Date(event.date + ' ' + event.startTime)
  const now = new Date()
  const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  const canRequestCancellation = hoursUntilEvent > 24

  const handleCancellationRequest = () => {
    toast.success('Cancellation request submitted')
  }

  const showWeather = hoursUntilEvent > 0 && hoursUntilEvent < 120

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap gap-2">
              <Badge className={eventTypeColors[event.eventType]}>{event.eventType}</Badge>
              <Badge className={statusColors[event.status]}>{event.status}</Badge>
            </div>
            <CardTitle className="text-lg">{event.title}</CardTitle>
          </div>
          {showWeather && (
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Weather</div>
              <div className="font-medium">18°C ⛅</div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <CalendarBlank className="text-muted-foreground" size={16} />
          <span className="font-medium">{new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Clock className="text-muted-foreground" size={16} />
          <span>{event.startTime} - {event.endTime}</span>
        </div>

        {site && field && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="text-muted-foreground mt-0.5" size={16} />
                <div>
                  <div className="font-semibold">{site.name} - {field.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {site.address}, {site.zipCode} {site.city}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 ml-6">
                {site.amenities.parking && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CarSimple size={14} />
                    <span>Parking</span>
                  </div>
                )}
                {site.amenities.toilets && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Toilet size={14} />
                    <span>Toilets</span>
                  </div>
                )}
                {site.amenities.lockerRooms && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lockers size={14} />
                    <span>Lockers</span>
                  </div>
                )}
                {site.amenities.shower && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Shower size={14} />
                    <span>Shower</span>
                  </div>
                )}
                {site.amenities.restaurant && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ForkKnife size={14} />
                    <span>Restaurant</span>
                  </div>
                )}
                {site.amenities.equipmentStash && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Package size={14} />
                    <span>Equipment</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 ml-6 text-xs">
                <span className="flex items-center gap-1">
                  <Plant size={14} />
                  {field.turfType}
                </span>
                {field.hasLights && (
                  <span className="flex items-center gap-1">
                    <Lightning size={14} />
                    Lights
                  </span>
                )}
                <span>{field.fieldSize} Field</span>
                {field.capacity && <span>Capacity: {field.capacity}</span>}
              </div>
            </div>
          </>
        )}

        {eventTeams.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="text-muted-foreground" size={16} />
                <span>Teams</span>
              </div>
              <div className="ml-6 space-y-2">
                {eventTeams.map(team => (
                  <div key={team.id} className="text-sm">
                    <div className="font-medium">{team.name}</div>
                    {(event.eventType === 'Game' || event.eventType === 'Practice') && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {team.headCoach && (
                          <div>Coach: {team.headCoach.firstName} {team.headCoach.lastName}</div>
                        )}
                        {team.teamManager && (
                          <div>Manager: {team.teamManager.firstName} {team.teamManager.lastName}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {event.otherParticipants && (
          <div className="text-sm">
            <span className="text-muted-foreground">Participants: </span>
            <span>{event.otherParticipants}</span>
          </div>
        )}

        {canRequestCancellation && (
          <>
            <Separator />
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleCancellationRequest}
            >
              <Prohibit className="mr-2" size={16} />
              Request Cancellation
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}