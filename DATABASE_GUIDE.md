# SQL-Like Database System Guide

## Overview

Your QMT Operations app now has a comprehensive SQL-like database layer built on top of the Spark KV persistence API. This system provides full CRUD (Create, Read, Update, Delete) capabilities with data validation, type safety, and advanced querying features similar to SQL databases.

## Architecture

### Data Storage
- **Backend**: Spark KV (Key-Value) persistence API
- **Validation**: Zod schema validation for all operations
- **Type Safety**: Full TypeScript support
- **Persistence**: Data survives page refreshes and sessions

### Available Tables
- `teams` - Football teams (tackle/flag)
- `sites` - Facility locations
- `fields` - Individual playing fields
- `schedule` - Events and games
- `requests` - Facility/equipment/cancellation requests
- `users` - System users (QMTadmin/QMTmgmt)

## Core Operations

### 1. SELECT - Query Records

#### Select All Records
```typescript
import { Database } from '@/lib/database';
import { Team } from '@/lib/types';

const allTeams = await Database.select<Team>('teams');
```

#### Select with WHERE Clause
```typescript
const activeTeams = await Database.select<Team>('teams', {
  isActive: true
});

const tackleteams = await Database.select<Team>('teams', {
  sportType: 'tackle'
});

const activeFlags = await Database.select<Team>('teams', {
  isActive: true,
  sportType: 'flag'
});
```

#### Select with Function-Based WHERE
```typescript
const teamsWithCoaches = await Database.select<Team>('teams', {
  headCoachName: (name) => name !== undefined && name !== ''
});

const sitesInZurich = await Database.select<Site>('sites', {
  city: (city) => city.toLowerCase().includes('zurich')
});
```

#### Select By ID
```typescript
const team = await Database.selectById<Team>('teams', 'team-123');
```

### 2. INSERT - Create Records

#### Insert Single Record
```typescript
import { v4 as uuidv4 } from 'uuid';

const newTeam: Team = {
  id: uuidv4(),
  name: 'Zurich Renegades',
  sportType: 'tackle',
  isActive: true,
  headCoachName: 'John Smith',
  headCoachEmail: 'john@example.com'
};

try {
  const created = await Database.insert('teams', newTeam);
  console.log('Created:', created);
} catch (error) {
  console.error('Insert failed:', error.message);
}
```

#### Insert Multiple Records
```typescript
const newTeams: Team[] = [
  {
    id: uuidv4(),
    name: 'Team A',
    sportType: 'tackle',
    isActive: true
  },
  {
    id: uuidv4(),
    name: 'Team B',
    sportType: 'flag',
    isActive: true
  }
];

const created = await Database.insertMany('teams', newTeams);
```

### 3. UPDATE - Modify Records

#### Update by ID
```typescript
const updated = await Database.update<Team>('teams', 'team-123', {
  headCoachName: 'Jane Doe',
  headCoachEmail: 'jane@example.com'
});

if (updated) {
  console.log('Updated successfully:', updated);
} else {
  console.log('Team not found');
}
```

#### Update Multiple Records (WHERE Clause)
```typescript
const count = await Database.updateWhere<Team>('teams', 
  { sportType: 'tackle' },
  { isActive: false }
);

console.log(`Deactivated ${count} tackle teams`);
```

#### Update with Function Filter
```typescript
const count = await Database.updateWhere<Request>('requests',
  { 
    status: 'pending',
    createdAt: (date) => {
      const createdDate = new Date(date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return createdDate < thirtyDaysAgo;
    }
  },
  { status: 'rejected' }
);
```

### 4. DELETE - Remove Records

#### Delete by ID
```typescript
const deleted = await Database.delete('teams', 'team-123');

if (deleted) {
  console.log('Team deleted successfully');
} else {
  console.log('Team not found');
}
```

#### Delete Multiple Records (WHERE Clause)
```typescript
const count = await Database.deleteWhere<Team>('teams', {
  isActive: false
});

console.log(`Deleted ${count} inactive teams`);
```

### 5. Additional Utilities

#### Count Records
```typescript
const totalTeams = await Database.count<Team>('teams');

const activeTackleTeams = await Database.count<Team>('teams', {
  isActive: true,
  sportType: 'tackle'
});
```

#### Check if Record Exists
```typescript
const teamExists = await Database.exists<Team>('teams', {
  name: 'Zurich Renegades'
});

if (teamExists) {
  console.log('Team already exists!');
}
```

#### Clear Entire Table
```typescript
await Database.clear('teams');
```

## Advanced Usage Examples

### Example 1: Create a Request with Validation
```typescript
import { Request } from '@/lib/types';
import { Database } from '@/lib/database';
import { toast } from 'sonner';

async function createFacilityRequest(teamId: string, fieldId: string, date: string) {
  const request: Request = {
    id: uuidv4(),
    type: 'facility',
    teamId,
    fieldId,
    requestedBy: 'John Smith',
    requestedDate: date,
    description: 'Practice session request',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  try {
    await Database.insert('requests', request);
    toast.success('Request submitted successfully!');
  } catch (error) {
    toast.error('Failed to create request: ' + error.message);
  }
}
```

### Example 2: Get Upcoming Events with Joins
```typescript
async function getUpcomingEventsWithDetails() {
  const now = new Date().toISOString();
  
  const upcomingEvents = await Database.select<ScheduleEvent>('schedule', {
    startTime: (time) => time > now,
    status: (status) => status !== 'cancelled'
  });

  const teams = await Database.select<Team>('teams');
  const fields = await Database.select<Field>('fields');
  const sites = await Database.select<Site>('sites');

  return upcomingEvents.map(event => {
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
}
```

### Example 3: Batch Update Statuses
```typescript
async function approveAllPendingRequests() {
  const count = await Database.updateWhere<Request>('requests',
    { status: 'pending' },
    { status: 'approved' }
  );
  
  toast.success(`Approved ${count} pending requests`);
  return count;
}
```

### Example 4: Complex Filtering
```typescript
async function findAvailableFields(date: string) {
  const sites = await Database.select<Site>('sites', {
    isActive: true,
    hasLights: true
  });

  const allFields = await Database.select<Field>('fields');
  const availableFields = allFields.filter(field => 
    sites.some(site => site.id === field.siteId)
  );

  const schedule = await Database.select<ScheduleEvent>('schedule', {
    startTime: (time) => time.startsWith(date)
  });

  const bookedFieldIds = new Set(schedule.map(event => event.fieldId));

  return availableFields.filter(field => !bookedFieldIds.has(field.id));
}
```

## Data Validation

All operations automatically validate data using Zod schemas:

```typescript
try {
  await Database.insert('teams', {
    id: '123',
    name: '', // ❌ Will fail - name is required
    sportType: 'tackle',
    isActive: true
  });
} catch (error) {
  console.error(error);
}

try {
  await Database.insert('teams', {
    id: '123',
    name: 'Valid Team',
    sportType: 'invalid', // ❌ Will fail - must be 'tackle', 'flag', or 'all sports'
    isActive: true
  });
} catch (error) {
  console.error(error);
}
```

## Backup & Restore

### Create Backup
```typescript
const backup = await Database.backup();
localStorage.setItem('qmt-backup', JSON.stringify(backup));
console.log('Backup created');
```

### Restore from Backup
```typescript
const backupData = JSON.parse(localStorage.getItem('qmt-backup'));
await Database.restore(backupData);
console.log('Database restored');
```

### Download Backup
```typescript
async function downloadBackup() {
  const backup = await Database.backup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qmt-backup-${new Date().toISOString()}.json`;
  a.click();
}
```

## Integration with React Components

### Using Database in Components
```typescript
import { useEffect, useState } from 'react';
import { Database } from '@/lib/database';
import { Team } from '@/lib/types';

function TeamsList() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    setLoading(true);
    const data = await Database.select<Team>('teams', { isActive: true });
    setTeams(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await Database.delete('teams', id);
    await loadTeams(); // Refresh list
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {teams.map(team => (
        <div key={team.id}>
          <h3>{team.name}</h3>
          <button onClick={() => handleDelete(team.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

## Best Practices

1. **Always use try-catch** for error handling
2. **Validate before insert** - schemas will catch errors
3. **Use UUIDs** for IDs (uuid library is installed)
4. **Create indexes** by structuring queries efficiently
5. **Batch operations** when possible (use insertMany, updateWhere, deleteWhere)
6. **Regular backups** for important data
7. **Type everything** - leverage TypeScript for safety

## Comparison to SQL

| SQL Command | Database Class Method |
|------------|----------------------|
| `SELECT * FROM teams` | `Database.select('teams')` |
| `SELECT * FROM teams WHERE isActive = true` | `Database.select('teams', { isActive: true })` |
| `SELECT * FROM teams WHERE id = '123'` | `Database.selectById('teams', '123')` |
| `INSERT INTO teams VALUES (...)` | `Database.insert('teams', record)` |
| `UPDATE teams SET ... WHERE id = '123'` | `Database.update('teams', '123', updates)` |
| `UPDATE teams SET ... WHERE isActive = false` | `Database.updateWhere('teams', { isActive: false }, updates)` |
| `DELETE FROM teams WHERE id = '123'` | `Database.delete('teams', '123')` |
| `DELETE FROM teams WHERE isActive = false` | `Database.deleteWhere('teams', { isActive: false })` |
| `SELECT COUNT(*) FROM teams` | `Database.count('teams')` |
| `TRUNCATE TABLE teams` | `Database.clear('teams')` |

## Performance Considerations

- All data is loaded into memory for operations
- Filtering happens client-side
- Best for datasets < 10,000 records per table
- For larger datasets, consider pagination in your UI
- Use function-based WHERE clauses sparingly (they're slower)

## Conclusion

This database system gives you the power of SQL-like operations while maintaining the simplicity of the Spark KV persistence API. It's perfect for managing structured data in your QMT Operations application with full type safety and validation.
