import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarBlank, MapPin, Clipboard, ShieldCheck } from '@phosphor-icons/react';
import { GridironIcon } from '@/components/icons/GridironIcon';
import { HelmetIcon } from '@/components/icons/HelmetIcon';
import { useTeams, useFields, useSites, useSchedule } from '@/hooks/use-data';
import { useAuth } from '@/hooks/use-auth';
import { getUpcomingEvents, getEventsBySportType, getEventsByTeam, getTeamById, getFieldById, getSiteById } from '@/lib/data-helpers';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface DashboardProps {
  onRequestFacility: () => void;
  onRequestEquipment: () => void;
  onManagement: () => void;
}

export function Dashboard({ onRequestFacility, onRequestEquipment, onManagement }: DashboardProps) {
  const [teams] = useTeams();
  const [fields] = useFields();
  const [sites] = useSites();
  const [schedule] = useSchedule();
  const { authState } = useAuth();
  
  const [sportFilter, setSportFilter] = useState<'all' | 'tackle' | 'flag'>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  const upcomingEvents = useMemo(() => {
    let events = getUpcomingEvents(schedule || []);
    events = getEventsBySportType(events, fields || [], teams || [], sportFilter);
    if (teamFilter !== 'all') {
      events = getEventsByTeam(events, teamFilter);
    }
    return events;
  }, [schedule, fields, teams, sportFilter, teamFilter]);

  const tackleTeams = useMemo(() => teams?.filter(t => t.sportType === 'tackle') || [], [teams]);
  const flagTeams = useMemo(() => teams?.filter(t => t.sportType === 'flag') || [], [teams]);

  const getSportLabel = () => {
    if (sportFilter === 'all') return 'All';
    if (sportFilter === 'tackle') return 'Tackle Football';
    return 'Flag Football';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="bg-gradient-to-r from-primary via-primary/95 to-secondary shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary-foreground tracking-tight">
                ZURICH RENEGADES FOOTBALL
              </h1>
              <p className="text-primary-foreground/90 text-sm font-medium mt-1">
                Quick Mean Tough | Operations
              </p>
            </div>
            {authState?.isAuthenticated ? (
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold text-sm">
                  {authState.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-primary-foreground font-medium">{authState.username}</span>
              </div>
            ) : (
              <Button 
                onClick={onManagement}
                className="bg-white/10 hover:bg-white/20 text-primary-foreground border border-white/30 backdrop-blur-sm"
              >
                Management Login
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

          <div className="grid grid-cols-3 gap-3 mb-8 p-2 bg-card rounded-2xl shadow-lg border border-border">
            <button
              onClick={() => setSportFilter('all')}
              className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                sportFilter === 'all'
                  ? 'bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-lg scale-105'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <GridironIcon size={24} className={sportFilter === 'all' ? 'drop-shadow-lg' : ''} />
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
              <HelmetIcon size={24} filled={sportFilter === 'tackle'} className={sportFilter === 'tackle' ? 'drop-shadow-lg' : ''} />
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
              <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor">
                <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,56h64V200H40ZM216,200H120V56h96V200Z"/>
              </svg>
              <span className="hidden sm:inline">Flag Football</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="bg-card shadow-sm border-border h-14">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {tackleTeams.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Tackle</div>
                    {tackleTeams.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </>
                )}
                {flagTeams.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Flag</div>
                    {flagTeams.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            <Button 
              onClick={onRequestFacility}
              className="h-14 bg-gradient-to-br from-secondary to-accent hover:shadow-lg transition-all duration-300 text-white font-semibold gap-2"
            >
              <GridironIcon size={20} />
              Request Facility
            </Button>

            <Button 
              onClick={onRequestEquipment}
              className="h-14 bg-gradient-to-br from-secondary to-accent hover:shadow-lg transition-all duration-300 text-white font-semibold gap-2"
            >
              <Clipboard size={20} weight="fill" />
              Request Equipment
            </Button>

            <Button 
              onClick={onManagement}
              className="h-14 bg-gradient-to-br from-primary to-primary/80 hover:shadow-lg transition-all duration-300 font-semibold gap-2"
            >
              <ShieldCheck size={20} weight="fill" />
              Management Section
            </Button>
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
                const team = getTeamById(teams || [], event.teamId);
                const field = getFieldById(fields || [], event.fieldId);
                const site = field ? getSiteById(sites || [], field.siteId) : undefined;

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="bg-gradient-to-br from-card to-muted/20 border-border shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className={`h-1.5 bg-gradient-to-r ${
                        team?.sportType === 'tackle' 
                          ? 'from-primary to-secondary' 
                          : 'from-secondary to-accent'
                      }`} />
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {team?.sportType === 'tackle' ? (
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <HelmetIcon size={24} filled className="text-primary" />
                                </div>
                              ) : (
                                <div className="p-2 rounded-lg bg-accent/10">
                                  <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" className="text-accent">
                                    <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,56h64V200H40ZM216,200H120V56h96V200Z"/>
                                  </svg>
                                </div>
                              )}
                              <div>
                                <h3 className="text-xl font-bold">{team?.name || 'Unknown Team'}</h3>
                                {event.opponent && (
                                  <p className="text-sm text-muted-foreground">vs {event.opponent}</p>
                                )}
                              </div>
                            </div>
                            <div className="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide">
                              {event.eventType}
                            </div>
                          </div>
                          <div className="text-right bg-muted/50 px-4 py-2 rounded-xl">
                            <div className="text-sm font-bold text-primary">{format(new Date(event.startTime), 'MMM d, yyyy')}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin size={16} weight="fill" className="text-secondary" />
                          <span className="font-medium">{site?.name || 'Unknown Site'} - {field?.name || 'Unknown Field'}</span>
                        </div>
                        {event.notes && (
                          <p className="mt-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">{event.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
