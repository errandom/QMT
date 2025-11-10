import { useKV } from '@github/spark/hooks';
import { Team, Site, Field, ScheduleEvent, Request, User } from '@/lib/types';

export const useTeams = () => {
  return useKV<Team[]>('teams', []);
};

export const useSites = () => {
  return useKV<Site[]>('sites', []);
};

export const useFields = () => {
  return useKV<Field[]>('fields', []);
};

export const useSchedule = () => {
  return useKV<ScheduleEvent[]>('schedule', []);
};

export const useRequests = () => {
  return useKV<Request[]>('requests', []);
};

export const useUsers = () => {
  return useKV<User[]>('users', []);
};
