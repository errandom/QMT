import { useState, useEffect } from 'react'
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
  Lightbulb,
  Trophy,
  Barbell,
  Strategy,
  CalendarCheck
} from '@phosphor-icons/react'
import { Event, Team, Field, Site, EventType, WeatherForecast } from '@/lib/types'
import CancellationRequestDialog from './CancellationRequestDialog'
import { getWeatherForecast } from '@/lib/weatherService'
import { COLORS, SIZES } from '@/lib/constants'

interface EventCardProps {
  event: Event
  teams: Team[]
  fields: Field[]
  sites: Site[]
}

const eventTypeColors = {
  'Game': 'border-2 border-[oklch(0.35_0.10_250)] text-[oklch(0.35_0.10_250)] bg-transparent',
  'Practice': 'border-2 border-[oklch(0.35_0.10_250)] text-[oklch(0.35_0.10_250)] bg-transparent',
  'Meeting': 'border-2 border-[oklch(0.35_0.10_250)] text-[oklch(0.35_0.10_250)] bg-transparent',
  'Other': 'border-2 border-[oklch(0.35_0.10_250)] text-[oklch(0.35_0.10_250)] bg-transparent'
}

const eventTypeIcons: Record<EventType, React.ReactNode> = {
  'Game': <Trophy size={SIZES.ICON_SIZE_LARGE} weight="duotone" />,
  'Practice': <Barbell size={SIZES.ICON_SIZE_LARGE} weight="duotone" />,
  'Meeting': <Strategy size={SIZES.ICON_SIZE_LARGE} weight="duotone" />,
  'Other': <CalendarCheck size={SIZES.ICON_SIZE_LARGE} weight="duotone" />
}

const statusColors = {
  'Planned': 'border-2 border-yellow-500 text-yellow-600 bg-transparent',
  'Confirmed': 'border-2 border-green-600 text-green-600 bg-transparent',
  'Cancelled': 'border-2 border-destructive text-destructive bg-transparent'
}

export default function EventCard({ event, teams, fields, sites }: EventCardProps) {
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false)
  const [weather, setWeather] = useState<WeatherForecast | null>(null)
  const [loadingWeather, setLoadingWeather] = useState(false)
  
  const field = fields.find(f => f.id === event.fieldId)
  const site = field ? sites.find(s => s.id === field.siteId) : undefined
  const eventTeams = event.teamIds ? teams.filter(t => event.teamIds.includes(t.id)) : []
  
  const eventDate = new Date(event.date + ' ' + event.startTime)
  const now = new Date()
  const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  const canRequestCancellation = hoursUntilEvent > 24 && (event.status === 'Confirmed' || event.status === 'Planned')
  const isPastEvent = hoursUntilEvent < 0

  const showWeather = hoursUntilEvent > 0 && hoursUntilEvent < 72

  useEffect(() => {
    if (showWeather && site && !weather && !loadingWeather) {
      setLoadingWeather(true)
      getWeatherForecast(event.date, event.startTime, site.city, site.zipCode)
        .then(forecast => {
          setWeather(forecast)
          setLoadingWeather(false)
        })
        .catch(err => {
          console.error('Failed to load weather:', err)
          setLoadingWeather(false)
        })
    }
  }, [showWeather, site, event.date, event.startTime, weather, loadingWeather])

  return (
    <Card className={`overflow-hidden hover:shadow-2xl transition-all duration-300 glass-card border-white/30 hover:border-white/40 ${isPastEvent ? 'opacity-40' : ''}`} style={{ borderRadius: SIZES.BORDER_RADIUS }}>
      <CardHeader className="pb-1">
        <div className="space-y-3">
          {/* Badges and cancellation button row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={eventTypeColors[event.eventType]}>{event.eventType}</Badge>
              <Badge className={statusColors[event.status]}>{event.status}</Badge>
            </div>
            {canRequestCancellation && (
              <Button 
                variant="ghost"
                size="sm" 
                className="h-[26px] px-3 text-xs transition-all hover:bg-transparent whitespace-nowrap flex-shrink-0"
                style={{
                  backgroundColor: 'rgba(220, 38, 38, 0.15)',
                  color: 'rgb(220, 38, 38)',
                  border: 'none'
                }}
                onClick={() => setCancellationDialogOpen(true)}
              >
                <Prohibit className="mr-1.5" size={SIZES.ICON_SIZE_MINI} weight="bold" />
                <span className="hidden sm:inline">Request Cancellation</span>
                <span className="sm:hidden">Cancel</span>
              </Button>
            )}
          </div>
          
          {/* Title and Weather row - aligned at top */}
          <div className="flex items-start justify-between gap-4">
            {/* Event title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-0">
                <div style={{ color: COLORS.NAVY }} className="flex-shrink-0 mt-0.5">
                  {eventTypeIcons[event.eventType]}
                </div>
                <CardTitle className="text-xl font-semibold flex-1 break-words" style={{ color: COLORS.NAVY }}>{event.title}</CardTitle>
              </div>
            </div>
            
            {/* Weather forecast aligned at same level as title */}
            {showWeather && weather && (
              <div className="text-right text-sm min-w-[80px] flex-shrink-0">
                <div className="text-xs font-medium mb-1" style={{ color: '#6b7280' }}>Forecast</div>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-2xl leading-none">{weather.icon}</span>
                  <div className="text-left">
                    <div className="font-bold text-lg leading-tight" style={{ color: COLORS.NAVY }}>{weather.temperature}°C</div>
                    <div className="text-xs leading-tight" style={{ color: '#6b7280' }}>{weather.condition}</div>
                  </div>
                </div>
              </div>
            )}
            {showWeather && !weather && loadingWeather && (
              <div className="text-right text-sm min-w-[80px] flex-shrink-0">
                <div className="text-xs font-medium mb-1" style={{ color: '#6b7280' }}>Forecast</div>
                <div className="flex items-center justify-end gap-1.5">
                  <div className="animate-pulse text-base" style={{ color: '#6b7280' }}>Loading...</div>
                </div>
              </div>
            )}
          </div>
          
          {/* Other participants */}
          {event.otherParticipants && (
            <div className="text-base ml-9 break-words" style={{ color: COLORS.NAVY }}>
              <span style={{ color: '#6b7280' }}>{event.eventType === 'Game' ? 'Opponent: ' : 'Participants: '}</span>
              <span>{event.otherParticipants}</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2.5 pt-1">
        <div className="flex items-center gap-2 text-base" style={{ color: COLORS.NAVY }}>
          <CalendarBlank style={{ color: COLORS.ACCENT }} size={SIZES.ICON_SIZE_MEDIUM} weight="duotone" />
          <span className="font-medium">{new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <div className="flex items-center gap-2 text-base" style={{ color: COLORS.NAVY }}>
          <Clock style={{ color: COLORS.ACCENT }} size={SIZES.ICON_SIZE_MEDIUM} weight="duotone" />
          <span>{event.startTime} - {event.endTime}</span>
        </div>

        {site && field && (
          <>
            <Separator className="bg-white/30" />
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-base" style={{ color: COLORS.NAVY }}>
                <MapPin style={{ color: COLORS.ACCENT }} className="mt-0.5" size={SIZES.ICON_SIZE_MEDIUM} weight="duotone" />
                <div>
                  <div className="font-semibold">
                    {event.eventType === 'Meeting' || event.eventType === 'Other' 
                      ? site.name 
                      : `${site.name} - ${field.name}`}
                  </div>
                  <div className="text-sm" style={{ color: '#6b7280' }}>
                    {site.address}, {site.zipCode} {site.city}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 ml-6">
                {site.amenities.parking && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                    <CarSimple size={SIZES.ICON_SIZE_SMALL} weight="duotone" />
                    <span>Parking</span>
                  </div>
                )}
                {site.amenities.toilets && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                    <Toilet size={SIZES.ICON_SIZE_SMALL} weight="duotone" />
                    <span>Toilets</span>
                  </div>
                )}
                {site.amenities.lockerRooms && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                    <Lockers size={SIZES.ICON_SIZE_SMALL} weight="duotone" />
                    <span>Lockers</span>
                  </div>
                )}
                {site.amenities.shower && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                    <Shower size={SIZES.ICON_SIZE_SMALL} weight="duotone" />
                    <span>Shower</span>
                  </div>
                )}
                {site.amenities.restaurant && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                    <ForkKnife size={SIZES.ICON_SIZE_SMALL} weight="duotone" />
                    <span>Restaurant</span>
                  </div>
                )}
                {site.amenities.equipmentStash && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                    <Package size={SIZES.ICON_SIZE_SMALL} weight="duotone" />
                    <span>Equipment</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 ml-6 text-xs" style={{ color: COLORS.NAVY }}>
                <span className="flex items-center gap-1">
                  {field.turfType === 'Artificial Turf' ? (
                    <div className="relative inline-flex items-center justify-center" style={{ width: '16px', height: '16px' }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 2 L8 6 M6 3.5 L7 5.5 M10 3.5 L9 5.5 M5 6 L6.5 7.5 M11 6 L9.5 7.5 M8 8 L8 13 M4 10 L5.5 11.5 M12 10 L10.5 11.5" strokeLinecap="round" />
                        <circle cx="8" cy="8" r="6.5" />
                        <line x1="2" y1="2" x2="14" y2="14" strokeWidth="2" />
                      </svg>
                    </div>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 2 L8 6 M6 3.5 L7 5.5 M10 3.5 L9 5.5 M5 6 L6.5 7.5 M11 6 L9.5 7.5 M8 8 L8 13 M4 10 L5.5 11.5 M12 10 L10.5 11.5" strokeLinecap="round" />
                    </svg>
                  )}
                  {field.turfType}
                </span>
                {field.hasLights && (
                  <span className="flex items-center gap-1">
                    <Lightbulb size={SIZES.ICON_SIZE_SMALL} weight="duotone" />
                    Lights
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {field.fieldSize === 'Full' ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="3" width="12" height="10" />
                    </svg>
                  ) : field.fieldSize === 'Shared' ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="3" width="12" height="10" />
                      <rect x="2" y="3" width="6" height="10" fill="currentColor" opacity="0.3" />
                    </svg>
                  ) : (
                    <span>{field.fieldSize}</span>
                  )}
                  {field.fieldSize} Field
                </span>
                {field.capacity && <span>Capacity: {field.capacity}</span>}
              </div>
            </div>
          </>
        )}

        {eventTeams && eventTeams.length > 0 && (
          <>
            <Separator className="bg-white/30" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-base font-medium" style={{ color: COLORS.NAVY }}>
                <Users style={{ color: COLORS.ACCENT }} size={SIZES.ICON_SIZE_MEDIUM} weight="duotone" />
                <span>Teams</span>
              </div>
              <div className="ml-6 space-y-1.5">
                {eventTeams.map(team => (
                  <div key={team.id} className="text-base" style={{ color: COLORS.NAVY }}>
                    <div className="font-medium">{team.name}</div>
                    {(event.eventType === 'Game' || event.eventType === 'Practice') && (
                      <div className="text-sm space-y-0.5" style={{ color: '#6b7280' }}>
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
      </CardContent>
      
      <CancellationRequestDialog
        open={cancellationDialogOpen}
        onOpenChange={setCancellationDialogOpen}
        eventId={event.id}
        eventTitle={event.title}
        eventDate={event.date}
        eventTime={event.startTime}
      />
    </Card>
  )
}
