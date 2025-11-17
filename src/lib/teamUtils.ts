import { Team, SportType } from './types'

export function filterTeamsBySport(teams: Team[], sportType: SportType): Team[] {
  return teams.filter(team => team.isActive && team.sportType === sportType)
}

export function getTeamsBySportType(teams: Team[]): {
  tackle: Team[]
  flag: Team[]
} {
  return {
    tackle: filterTeamsBySport(teams, 'Tackle Football'),
    flag: filterTeamsBySport(teams, 'Flag Football'),
  }
}
