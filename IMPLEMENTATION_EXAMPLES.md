# Database Implementation Examples

This guide shows practical examples of how to use the SQL-like Database API in your QMT Operations components.

## Example 1: Refactoring Existing Management Components

### Before (using useKV directly)
```typescript
import { useKV } from '@github/spark/hooks';
import { Team } from '@/lib/types';

function TeamManagement() {
  const [teams, setTeams] = useKV<Team[]>('teams', []);

  const addTeam = (newTeam: Team) => {
    setTeams(currentTeams => [...currentTeams, newTeam]);
  };

  const updateTeam = (id: string, updates: Partial<Team>) => {
    setTeams(currentTeams =>
      currentTeams.map(team =>
        team.id === id ? { ...team, ...updates } : team
      )
    );
  };

  const deleteTeam = (id: string) => {
    setTeams(currentTeams => currentTeams.filter(team => team.id !== id));
  };

  return (
    // Component JSX
  );
}
```

### After (using Database API with React Hook)
```typescript
import { useDatabaseTable } from '@/lib/database-hooks';
import { Team } from '@/lib/types';
import { Database } from '@/lib/database';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

function TeamManagement() {
  const { data: teams, loading, refetch, insert, update, remove } = 
    useDatabaseTable<Team>('teams');

  const addTeam = async (teamData: Omit<Team, 'id'>) => {
    try {
      await insert({ id: uuidv4(), ...teamData } as Team);
      toast.success('Team added successfully');
    } catch (error: any) {
      toast.error('Failed to add team: ' + error.message);
    }
  };

  const updateTeam = async (id: string, updates: Partial<Team>) => {
    try {
      await update(id, updates);
      toast.success('Team updated successfully');
    } catch (error: any) {
      toast.error('Failed to update team: ' + error.message);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await remove(id);
      toast.success('Team deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete team: ' + error.message);
    }
  };

  if (loading) return <div>Loading teams...</div>;

  return (
    // Component JSX with teams data
  );
}
```

## Example 2: Advanced Filtering in Dashboard

```typescript
import { Database } from '@/lib/database';
import { Team, ScheduleEvent, Field, Site } from '@/lib/types';
import { useState, useEffect } from 'react';

function Dashboard() {
  const [sportFilter, setSportFilter] = useState<'all' | 'tackle' | 'flag'>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, [sportFilter, teamFilter]);

  async function loadEvents() {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      
      let filteredEvents = await Database.select<ScheduleEvent>('schedule', {
        startTime: (time) => time > now,
        status: (status) => status !== 'cancelled'
      });

      if (sportFilter !== 'all') {
        const teams = await Database.select<Team>('teams', {
          sportType: sportFilter
        });
        const teamIds = teams.map(t => t.id);
        
        filteredEvents = filteredEvents.filter(event =>
          event.teamIds.some(id => teamIds.includes(id))
        );
      }

      if (teamFilter !== 'all') {
        filteredEvents = filteredEvents.filter(event =>
          event.teamIds.includes(teamFilter)
        );
      }

      const [teams, fields, sites] = await Promise.all([
        Database.select<Team>('teams'),
        Database.select<Field>('fields'),
        Database.select<Site>('sites')
      ]);

      const enrichedEvents = filteredEvents.map(event => {
        const field = fields.find(f => f.id === event.fieldId);
        const site = field ? sites.find(s => s.id === field.siteId) : null;
        const eventTeams = event.teamIds
          .map(id => teams.find(t => t.id === id))
          .filter(Boolean);

        return {
          ...event,
          field,
          site,
          teams: eventTeams
        };
      }).sort((a, b) => a.startTime.localeCompare(b.startTime));

      setEvents(enrichedEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value as any)}>
          <option value="all">All Sports</option>
          <option value="tackle">Tackle</option>
          <option value="flag">Flag</option>
        </select>
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          <option value="all">All Teams</option>
        </select>
      </div>

      {loading ? (
        <div>Loading events...</div>
      ) : (
        <div className="grid gap-4">
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Example 3: Request Management with Complex Queries

```typescript
import { Database } from '@/lib/database';
import { Request, Team, Field, Site } from '@/lib/types';
import { useState, useEffect } from 'react';

function RequestManagement() {
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    loadRequests();
  }, [filter]);

  async function loadRequests() {
    try {
      const whereClause = filter === 'all' ? undefined : { status: filter };
      const requestData = await Database.select<Request>('requests', whereClause);

      const [teams, fields, sites] = await Promise.all([
        Database.select<Team>('teams'),
        Database.select<Field>('fields'),
        Database.select<Site>('sites')
      ]);

      const enrichedRequests = requestData.map(request => ({
        ...request,
        team: request.teamId ? teams.find(t => t.id === request.teamId) : null,
        field: request.fieldId ? fields.find(f => f.id === request.fieldId) : null,
        site: request.siteId ? sites.find(s => s.id === request.siteId) : null
      })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      setRequests(enrichedRequests);
    } catch (error) {
      console.error('Failed to load requests:', error);
    }
  }

  async function approveRequest(id: string) {
    try {
      await Database.update<Request>('requests', id, { status: 'approved' });
      toast.success('Request approved');
      await loadRequests();
    } catch (error: any) {
      toast.error('Failed to approve: ' + error.message);
    }
  }

  async function rejectRequest(id: string) {
    try {
      await Database.update<Request>('requests', id, { status: 'rejected' });
      toast.success('Request rejected');
      await loadRequests();
    } catch (error: any) {
      toast.error('Failed to reject: ' + error.message);
    }
  }

  async function bulkApprove() {
    try {
      const count = await Database.updateWhere<Request>(
        'requests',
        { status: 'pending' },
        { status: 'approved' }
      );
      toast.success(`Approved ${count} requests`);
      await loadRequests();
    } catch (error: any) {
      toast.error('Bulk approval failed: ' + error.message);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">All Requests</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button onClick={bulkApprove}>Approve All Pending</Button>
      </div>

      <div className="space-y-4">
        {requests.map(request => (
          <RequestCard
            key={request.id}
            request={request}
            onApprove={() => approveRequest(request.id)}
            onReject={() => rejectRequest(request.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

## Example 4: Statistics Dashboard

```typescript
import { Database } from '@/lib/database';
import { Team, Request, ScheduleEvent } from '@/lib/types';
import { useState, useEffect } from 'react';

function StatisticsDashboard() {
  const [stats, setStats] = useState({
    totalTeams: 0,
    activeTeams: 0,
    tackleTeams: 0,
    flagTeams: 0,
    pendingRequests: 0,
    upcomingEvents: 0,
    thisWeekEvents: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const now = new Date();
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(now.getDate() + 7);

    const [
      totalTeams,
      activeTeams,
      tackleTeams,
      flagTeams,
      pendingRequests,
      upcomingEvents,
      thisWeekEvents
    ] = await Promise.all([
      Database.count<Team>('teams'),
      Database.count<Team>('teams', { isActive: true }),
      Database.count<Team>('teams', { sportType: 'tackle' }),
      Database.count<Team>('teams', { sportType: 'flag' }),
      Database.count<Request>('requests', { status: 'pending' }),
      Database.count<ScheduleEvent>('schedule', {
        startTime: (time) => time > now.toISOString()
      }),
      Database.count<ScheduleEvent>('schedule', {
        startTime: (time) => {
          const eventDate = new Date(time);
          return eventDate > now && eventDate < oneWeekFromNow;
        }
      })
    ]);

    setStats({
      totalTeams,
      activeTeams,
      tackleTeams,
      flagTeams,
      pendingRequests,
      upcomingEvents,
      thisWeekEvents
    });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Total Teams" value={stats.totalTeams} />
      <StatCard label="Active Teams" value={stats.activeTeams} />
      <StatCard label="Tackle Teams" value={stats.tackleTeams} />
      <StatCard label="Flag Teams" value={stats.flagTeams} />
      <StatCard label="Pending Requests" value={stats.pendingRequests} />
      <StatCard label="Upcoming Events" value={stats.upcomingEvents} />
      <StatCard label="This Week" value={stats.thisWeekEvents} />
    </div>
  );
}
```

## Example 5: Data Validation and Error Handling

```typescript
import { Database } from '@/lib/database';
import { Team } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

async function createTeamWithValidation(formData: any) {
  try {
    const teamExists = await Database.exists<Team>('teams', {
      name: formData.name
    });

    if (teamExists) {
      toast.error('A team with this name already exists');
      return null;
    }

    const newTeam: Team = {
      id: uuidv4(),
      name: formData.name,
      sportType: formData.sportType,
      isActive: true,
      headCoachName: formData.headCoachName || undefined,
      headCoachEmail: formData.headCoachEmail || undefined,
      headCoachPhone: formData.headCoachPhone || undefined
    };

    const created = await Database.insert('teams', newTeam);
    toast.success('Team created successfully');
    return created;
    
  } catch (error: any) {
    if (error.message.includes('email')) {
      toast.error('Invalid email address provided');
    } else if (error.message.includes('required')) {
      toast.error('Please fill in all required fields');
    } else {
      toast.error('Failed to create team: ' + error.message);
    }
    return null;
  }
}
```

## Example 6: Backup and Export Features

```typescript
import { Database } from '@/lib/database';
import { Button } from '@/components/ui/button';

function DataManagement() {
  async function exportBackup() {
    try {
      const backup = await Database.backup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qmt-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Backup exported successfully');
    } catch (error: any) {
      toast.error('Export failed: ' + error.message);
    }
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      
      const confirm = window.confirm(
        'This will replace all current data. Are you sure?'
      );
      
      if (confirm) {
        await Database.restore(backup);
        toast.success('Backup restored successfully');
        window.location.reload();
      }
    } catch (error: any) {
      toast.error('Import failed: ' + error.message);
    }
  }

  return (
    <div className="flex gap-4">
      <Button onClick={exportBackup}>
        Export Data
      </Button>
      <Button onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
          if (e.target.files[0]) {
            importBackup(e.target.files[0]);
          }
        };
        input.click();
      }}>
        Import Data
      </Button>
    </div>
  );
}
```

## Key Takeaways

1. **Use Database.select() for queries** - More flexible than direct KV access
2. **Use async/await** - All database operations are asynchronous
3. **Handle errors with try-catch** - Database operations can throw validation errors
4. **Leverage WHERE clauses** - Both value-based and function-based filtering
5. **Batch operations when possible** - Use updateWhere, deleteWhere, insertMany
6. **Type everything** - Full TypeScript support for safety
7. **Toast notifications** - Provide user feedback for all operations
8. **Refetch after mutations** - Keep UI in sync with database state

## Migration Checklist

- [ ] Replace direct `useKV` calls with `Database` API
- [ ] Add proper error handling with try-catch blocks
- [ ] Add loading states for async operations
- [ ] Add toast notifications for user feedback
- [ ] Use WHERE clauses for filtering instead of manual array operations
- [ ] Leverage batch operations (updateWhere, deleteWhere) where applicable
- [ ] Add data validation using the built-in Zod schemas
- [ ] Test all CRUD operations thoroughly
