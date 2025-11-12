import { useEffect, useState } from 'react';
import { Database } from '@/lib/database';
import { Team, Site, Field, ScheduleEvent, Request, User } from '@/lib/types';

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Database.select<Team>('teams')
      .then(data => setTeams(data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { teams, loading, error };
};

export const useSites = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Database.select<Site>('sites')
      .then(data => setSites(data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { sites, loading, error };
};

export const useFields = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Database.select<Field>('fields')
      .then(data => setFields(data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { fields, loading, error };
};

export const useSchedule = () => {
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Database.select<ScheduleEvent>('schedule')
      .then(data => setSchedule(data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { schedule, loading, error };
};

export const useRequests = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Database.select<Request>('requests')
      .then(data => setRequests(data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { requests, loading, error };
};

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Database.select<User>('users')
      .then(data => setUsers(data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { users, loading, error };
};
