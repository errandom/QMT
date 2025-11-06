import { Team, Site, Field, ScheduleEvent } from './types';

export function getTeamById(teams: Team[], id: string): Team | undefined {
  return teams.find(team => team.id === id);
}

export function getSiteById(sites: Site[], id: string): Site | undefined {
  return sites.find(site => site.id === id);
}

export function getFieldById(fields: Field[], id: string): Field | undefined {
  return fields.find(field => field.id === id);
}

export function getFieldsBySite(fields: Field[], siteId: string): Field[] {
  return fields.filter(field => field.siteId === siteId);
}

export function getUpcomingEvents(schedule: ScheduleEvent[]): ScheduleEvent[] {
  const now = new Date();
  return schedule
    .filter(event => new Date(event.endTime) >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export function getEventsByTeam(schedule: ScheduleEvent[], teamId: string): ScheduleEvent[] {
  return schedule.filter(event => event.teamIds && event.teamIds.includes(teamId));
}

export function getEventsBySportType(
  schedule: ScheduleEvent[],
  fields: Field[],
  teams: Team[],
  sportType: 'all' | 'tackle' | 'flag'
): ScheduleEvent[] {
  if (sportType === 'all') return schedule;
  
  return schedule.filter(event => {
    if (!event.teamIds || event.teamIds.length === 0) return false;
    return event.teamIds.some(teamId => {
      const team = getTeamById(teams, teamId);
      return team?.sportType === sportType;
    });
  });
}
