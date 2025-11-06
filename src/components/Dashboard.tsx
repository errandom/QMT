import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarBlank, MapPin, Clipboard, UserCircleGear, Crown, Star, Trophy, Barbell, Chalkboard, Calendar, PlusCircle, SignOut, Gear, FadersHorizontal, Circle, XCircle, Lightbulb, Plant, Toilet, Lockers, Backpack, ForkKnife, Football, Toolbox, Car } from '@phosphor-icons/react';
import { FootballHelmet } from '@phosphor-icons/react';
import { useTeams, useFields, useSites, useSchedule } from '@/hooks/use-data';
import { useAuth } from '@/hooks/use-auth';
import { getUpcomingEvents, getEventsBySportType, getEventsByTeam, getTeamById, getFieldById, getSiteById } from '@/lib/data-helpers';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { CancellationRequestDialog } from '@/components/CancellationRequestDialog';
import { ScheduleEvent } from '@/lib/types';
import { ZurichRenegadesLogo } from '@/components/icons';

interface DashboardProps {
  onRequestFacility: () => void;
  onRequestEquipment: () => void;
  onManagement: () => void;
  onLogout?: () => void;
  onLogin: () => void;
}

export function Dashboard({ onRequestFacility, onRequestEquipment, onManagement, onLogout, onLogin }: DashboardProps) {
  const [teams] = useTeams();
  const [fields] = useFields();
  const [sites] = useSites();
  const [schedule] = useSchedule();
  const { authState, logout } = useAuth();
  
  const [sportFilter, setSportFilter] = useState<'all' | 'tackle' | 'flag'>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [cancellationEvent, setCancellationEvent] = useState<ScheduleEvent | null>(null);

  const handleLogout = () => {
    logout();
    if (onLogout) {
      onLogout();
    }
  };

  const canRequestCancellation = (event: ScheduleEvent): boolean => {
    const eventStartTime = new Date(event.startTime);
    const now = new Date();
    const hoursDifference = (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursDifference > 36;
  };

  const upcomingEvents = useMemo(() => {
    let events = getUpcomingEvents(schedule || []);
    events = getEventsBySportType(events, fields || [], teams || [], sportFilter);
    if (teamFilter !== 'all') {
      events = getEventsByTeam(events, teamFilter);
    }
    return events;
  }, [schedule, fields, teams, sportFilter, teamFilter]);

  const tackleTeams = useMemo(() => teams?.filter(t => t.sportType === 'tackle' && t.isActive) || [], [teams]);
  const flagTeams = useMemo(() => teams?.filter(t => t.sportType === 'flag' && t.isActive) || [], [teams]);

  const filteredTeams = useMemo(() => {
    if (sportFilter === 'tackle') return tackleTeams;
    if (sportFilter === 'flag') return flagTeams;
    return [...tackleTeams, ...flagTeams];
  }, [sportFilter, tackleTeams, flagTeams]);

  useEffect(() => {
    if (teamFilter !== 'all') {
      const isTeamInFilteredList = filteredTeams.some(t => t.id === teamFilter);
      if (!isTeamInFilteredList) {
        setTeamFilter('all');
      }
    }
  }, [sportFilter, teamFilter, filteredTeams]);

  const getSportLabel = () => {
    if (sportFilter === 'all') return 'All';
    if (sportFilter === 'tackle') return 'Tackle Football';
    return 'Flag Football';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="bg-gradient-to-r from-primary via-primary/95 to-secondary shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <ZurichRenegadesLogo size={60} className="text-primary-foreground hidden sm:block flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-primary-foreground tracking-tight">QMT | Operations</h1>
                <p className="text-primary-foreground/90 text-sm md:text-base font-bold mt-1">ZURICH RENEGADES FOOTBALL</p>
              </div>
            </div>
            {authState?.isAuthenticated ? (
              <div className="flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-3">
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground">
                    {authState.role === 'QMTadmin' ? (
                      <Crown size={20} weight="duotone" />
                    ) : (
                      <Star size={20} weight="duotone" />
                    )}
                  </div>
                  <span className="text-primary-foreground font-medium hidden md:inline">{authState.username}</span>
                </div>
                <Button 
                  variant="ghost" 
                  onClick={handleLogout} 
                  className="gap-2 text-primary-foreground hover:bg-white/10 md:h-auto h-8 md:px-4 px-2"
                >
                  <SignOut size={18} weight="duotone" />
                  <span className="hidden md:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                onClick={onLogin} 
                className="gap-2 text-primary-foreground hover:bg-white/10 border border-white/20 font-semibold"
              >
                <UserCircleGear size={20} weight="duotone" />
                <span className="hidden md:inline">Login</span>
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-muted-foreground mb-8">Upcoming Events - {getSportLabel()}</p>

          <div className="flex flex-col gap-4 mb-8">
            <div className="grid grid-cols-3 gap-3 p-2 bg-card rounded-2xl shadow-lg border border-border">
              <button
                onClick={() => setSportFilter('all')}
                className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  sportFilter === 'all'
                    ? 'bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-lg scale-105'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Football size={24} weight="duotone" className={sportFilter === 'all' ? 'drop-shadow-lg' : ''} />
                  <FootballHelmet size={24} weight="duotone" className={sportFilter === 'all' ? 'drop-shadow-lg' : ''} />
                </div>
                <span className="hidden sm:inline">All Sports</span>
              </button>
              <button
                onClick={() => setSportFilter('tackle')}
                className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  sportFilter === 'tackle'
                    ? 'bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-lg scale-105'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <FootballHelmet size={24} weight="duotone" className={sportFilter === 'tackle' ? 'drop-shadow-lg' : ''} />
                <span className="hidden sm:inline">Tackle Football</span>
              </button>
              <button
                onClick={() => setSportFilter('flag')}
                className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  sportFilter === 'flag'
                    ? 'bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-lg scale-105'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Football size={24} weight="duotone" className={sportFilter === 'flag' ? 'drop-shadow-lg' : ''} />
                <span className="hidden sm:inline">Flag Football</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="bg-card shadow-sm border-border min-h-11 h-11 w-full">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent className="w-[280px]">
                  <SelectItem value="all">All Teams</SelectItem>
                  {sportFilter === 'all' ? (
                    <>
                      {tackleTeams.length > 0 && (
                        <>
                          <div className="px-2 py-2 text-xs font-bold text-primary bg-primary/5 flex items-center gap-2 border-b border-border">
                            <FootballHelmet size={16} weight="duotone" />
                            TACKLE FOOTBALL
                          </div>
                          {tackleTeams.map(team => (
                            <SelectItem key={team.id} value={team.id} className="pl-8">
                              <div className="flex items-center gap-2">
                                <FootballHelmet size={14} weight="duotone" className="text-primary/60" />
                                {team.name}
                              </div>
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {flagTeams.length > 0 && (
                        <>
                          <div className="px-2 py-2 text-xs font-bold text-secondary bg-secondary/5 flex items-center gap-2 border-b border-border mt-1">
                            <Football size={16} weight="duotone" />
                            FLAG FOOTBALL
                          </div>
                          {flagTeams.map(team => (
                            <SelectItem key={team.id} value={team.id} className="pl-8">
                              <div className="flex items-center gap-2">
                                <Football size={14} weight="duotone" className="text-secondary/60" />
                                {team.name}
                              </div>
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    filteredTeams.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Button 
                onClick={onRequestFacility}
                className="h-11 bg-gradient-to-br from-secondary to-accent hover:shadow-lg transition-all duration-300 text-white font-semibold gap-2"
              >
                <PlusCircle size={20} weight="duotone" />
                Facility
              </Button>

              <Button 
                onClick={onRequestEquipment}
                className="h-11 bg-gradient-to-br from-secondary to-accent hover:shadow-lg transition-all duration-300 text-white font-semibold gap-2"
              >
                <PlusCircle size={20} weight="duotone" />
                Equipment
              </Button>

              <Button 
                onClick={onManagement}
                className="h-11 bg-gradient-to-br from-primary to-primary/80 hover:shadow-lg transition-all duration-300 font-semibold gap-2"
              >
                <Clipboard size={20} weight="duotone" />
                Management
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {upcomingEvents.length === 0 ? (
              <Card className="bg-gradient-to-br from-card to-muted/30 border-border shadow-lg">
                <CardContent className="py-16 text-center">
                  <div className="inline-flex p-6 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 mb-4">
                    <CalendarBlank size={48} className="text-primary" weight="duotone" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Upcoming Events</h3>
                  <p className="text-muted-foreground">There are currently no scheduled events. Check back soon!</p>
                </CardContent>
              </Card>
            ) : (
              upcomingEvents.map((event, index) => {
                const eventTeams = (event.teamIds || []).map(id => getTeamById(teams || [], id)).filter(Boolean);
                const firstTeam = eventTeams[0];
                const field = event.fieldId ? getFieldById(fields || [], event.fieldId) : undefined;
                const site = field 
                  ? getSiteById(sites || [], field.siteId) 
                  : event.siteId 
                    ? getSiteById(sites || [], event.siteId)
                    : undefined;
                const canCancel = canRequestCancellation(event);

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="bg-gradient-to-br from-card to-muted/20 border-border shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <CardContent className="px-6 py-3">
                        <div className="flex items-center justify-end gap-2 mb-2 min-h-[28px]">
                          <Badge variant="outline" className="text-xs lowercase font-semibold text-foreground border-foreground/30 h-7 items-center hidden md:flex">
                            {event.eventType}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-medium text-muted-foreground border-muted-foreground/30 h-7 flex items-center">
                            {event.status}
                          </Badge>
                          {canCancel && event.status !== 'cancelled' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCancellationEvent(event)}
                              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 h-7 text-xs px-2"
                            >
                              <XCircle size={14} weight="duotone" />
                              <span className="hidden md:inline">Request Cancellation</span>
                              <span className="md:hidden">Cancel</span>
                            </Button>
                          )}
                        </div>
                      <div className={`h-1.5 bg-gradient-to-r ${
                        firstTeam?.sportType === 'tackle' 
                          ? 'from-primary to-secondary' 
                          : 'from-secondary to-accent'
                      } mb-4 w-full`} />
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3 flex-1">
                            {event.eventType === 'practice' ? (
                              <div className="p-2 rounded-lg bg-secondary/10">
                                <Barbell size={24} weight="duotone" className="text-secondary" />
                              </div>
                            ) : event.eventType === 'game' ? (
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Trophy size={24} weight="duotone" className="text-primary" />
                              </div>
                            ) : event.eventType === 'meeting' ? (
                              <div className="p-2 rounded-lg bg-accent/10">
                                <Chalkboard size={24} weight="duotone" className="text-accent" />
                              </div>
                            ) : (
                              <div className="p-2 rounded-lg bg-muted">
                                <Calendar size={24} weight="duotone" className="text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1">
                              <h3 className="text-xl font-bold">
                                {eventTeams.map(t => t?.name).join(' & ') || 'Unknown Team'}
                              </h3>
                              {event.opponent && (
                                <p className="text-sm text-muted-foreground">vs {event.opponent}</p>
                              )}
                            </div>
                            <div className="bg-muted/50 px-3 py-1.5 rounded-lg flex-shrink-0">
                              <div className="text-sm font-bold text-primary">{format(new Date(event.startTime), 'MMM d, yyyy')}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-border pt-4 space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin size={16} weight="duotone" className="text-secondary flex-shrink-0" />
                            {field ? (
                              <span className="font-medium">{site?.name || 'Unknown Site'} - {field.name}</span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-medium">{site?.name || 'Unknown Site'}</span>
                                {site && (
                                  <span className="text-xs text-muted-foreground">{site.address}, {site.city}, {site.state} {site.zipCode}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {field && site && (
                            <div className="flex flex-wrap gap-2">
                              {field.hasLights && (
                                <Badge className="text-xs gap-1 bg-amber-500/20 text-amber-900 border-amber-500/40 font-semibold">
                                  <Lightbulb size={14} weight="duotone" className="text-amber-600" />
                                  Lights
                                </Badge>
                              )}
                              <Badge className="text-xs gap-1 bg-emerald-500/20 text-emerald-900 border-emerald-500/40 font-semibold">
                                {field.turfType === 'artificial' ? (
                                  <>
                                    <Circle size={14} weight="duotone" className="text-emerald-600" />
                                    Artificial Turf
                                  </>
                                ) : field.turfType === 'natural' ? (
                                  <>
                                    <Plant size={14} weight="duotone" className="text-emerald-600" />
                                    Natural Grass
                                  </>
                                ) : (
                                  <>
                                    <Circle size={14} weight="duotone" className="text-emerald-600" />
                                    Indoor Gym
                                  </>
                                )}
                              </Badge>
                              <Badge className={`text-xs gap-1.5 font-semibold relative overflow-hidden ${
                                field.isFullField 
                                  ? 'bg-emerald-500/20 text-emerald-900 border-emerald-500/40'
                                  : 'bg-gradient-to-r from-emerald-500/20 to-transparent text-emerald-900 border-emerald-500/40'
                              }`}>
                                {field.isFullField ? (
                                  <>Full Field</>
                                ) : (
                                  <>Half Field</>
                                )}
                              </Badge>
                              {site.hasToilets && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <Toilet size={14} weight="duotone" />
                                  Toilets
                                </Badge>
                              )}
                              {site.hasLockerRooms && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <Lockers size={14} weight="duotone" />
                                  Locker Rooms
                                </Badge>
                              )}
                              {site.hasEquipmentStash && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <Backpack size={14} weight="duotone" />
                                  Equipment Storage
                                </Badge>
                              )}
                              {site.hasRestaurant && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <ForkKnife size={14} weight="duotone" />
                                  Restaurant
                                </Badge>
                              )}
                              {site.hasParking && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <Car size={14} weight="duotone" />
                                  Parking
                                </Badge>
                              )}
                            </div>
                          )}

                          {!field && site && (
                            <div className="flex flex-wrap gap-2">
                              {site.hasToilets && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <Toilet size={14} weight="duotone" />
                                  Toilets
                                </Badge>
                              )}
                              {site.hasLockerRooms && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <Lockers size={14} weight="duotone" />
                                  Locker Rooms
                                </Badge>
                              )}
                              {site.hasEquipmentStash && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <Backpack size={14} weight="duotone" />
                                  Equipment Storage
                                </Badge>
                              )}
                              {site.hasRestaurant && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <ForkKnife size={14} weight="duotone" />
                                  Restaurant
                                </Badge>
                              )}
                              {site.hasParking && (
                                <Badge className="text-xs gap-1 bg-muted/80 text-muted-foreground border-border font-medium">
                                  <Car size={14} weight="duotone" />
                                  Parking
                                </Badge>
                              )}
                            </div>
                          )}

                          {eventTeams.length > 0 && (eventTeams[0]?.headCoachName || eventTeams[0]?.teamManagerName) && (
                            <div className="space-y-2">
                              {eventTeams[0]?.headCoachName && (
                                <div className="flex items-center gap-2 text-sm">
                                  <UserCircleGear size={16} weight="duotone" className="text-primary flex-shrink-0" />
                                  <div>
                                    <span className="font-semibold">Head Coach:</span> {eventTeams[0].headCoachName}
                                    {eventTeams[0].headCoachEmail && (
                                      <a href={`mailto:${eventTeams[0].headCoachEmail}`} className="ml-2 text-secondary hover:underline">
                                        {eventTeams[0].headCoachEmail}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                              {eventTeams[0]?.teamManagerName && (
                                <div className="flex items-center gap-2 text-sm">
                                  <UserCircleGear size={16} weight="duotone" className="text-accent flex-shrink-0" />
                                  <div>
                                    <span className="font-semibold">Team Manager:</span> {eventTeams[0].teamManagerName}
                                    {eventTeams[0].teamManagerEmail && (
                                      <a href={`mailto:${eventTeams[0].teamManagerEmail}`} className="ml-2 text-secondary hover:underline">
                                        {eventTeams[0].teamManagerEmail}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {event.notes && (
                            <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">{event.notes}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
      {cancellationEvent && (
        <CancellationRequestDialog
          open={!!cancellationEvent}
          onOpenChange={(open) => !open && setCancellationEvent(null)}
          event={cancellationEvent}
        />
      )}
    </div>
  );
}
