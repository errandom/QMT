import { useState } from 'react';
import { Database } from '@/lib/database';
import { Team, Site, Request } from '@/lib/types';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { Play, Download, Database as DatabaseIcon } from '@phosphor-icons/react';

export function DatabaseDemo() {
  const [results, setResults] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const runQuery = async (name: string, fn: () => Promise<any>) => {
    setLoading(true);
    try {
      const result = await fn();
      setResults(`${name}:\n${JSON.stringify(result, null, 2)}`);
      toast.success(`${name} completed successfully`);
    } catch (error: any) {
      setResults(`Error in ${name}:\n${error.message}`);
      toast.error(`${name} failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const queries = {
    selectAllTeams: {
      name: 'SELECT all teams',
      description: 'Fetch all teams from database',
      fn: () => Database.select<Team>('teams')
    },
    selectActiveTeams: {
      name: 'SELECT active teams',
      description: 'Filter teams WHERE isActive = true',
      fn: () => Database.select<Team>('teams', { isActive: true })
    },
    selectTackleTeams: {
      name: 'SELECT tackle teams',
      description: 'Filter teams WHERE sportType = "tackle"',
      fn: () => Database.select<Team>('teams', { sportType: 'tackle' })
    },
    countTeams: {
      name: 'COUNT teams',
      description: 'Count total number of teams',
      fn: () => Database.count<Team>('teams')
    },
    selectAllSites: {
      name: 'SELECT all sites',
      description: 'Fetch all facility sites',
      fn: () => Database.select<Site>('sites')
    },
    selectSitesWithToilets: {
      name: 'SELECT sites with toilets',
      description: 'Filter sites WHERE hasToilets = true',
      fn: () => Database.select<Site>('sites', { hasToilets: true })
    },
    selectPendingRequests: {
      name: 'SELECT pending requests',
      description: 'Filter requests WHERE status = "pending"',
      fn: () => Database.select<Request>('requests', { status: 'pending' })
    },
    selectCancellationRequests: {
      name: 'SELECT cancellation requests',
      description: 'Filter requests WHERE type = "cancellation"',
      fn: () => Database.select<Request>('requests', { type: 'cancellation' })
    },
    complexQuery: {
      name: 'Complex JOIN query',
      description: 'Get upcoming events with related data',
      fn: async () => {
        const now = new Date().toISOString();
        const schedule = await Database.select('schedule', {
          startTime: (time: string) => time > now
        });
        const teams = await Database.select('teams');
        const fields = await Database.select('fields');
        
        return schedule.slice(0, 5).map((event: any) => ({
          eventId: event.id,
          startTime: event.startTime,
          field: fields.find((f: any) => f.id === event.fieldId),
          teamCount: event.teamIds?.length || 0
        }));
      }
    }
  };

  const actions = {
    backup: async () => {
      setLoading(true);
      try {
        const backup = await Database.backup();
        const blob = new Blob([JSON.stringify(backup, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qmt-backup-${new Date().toISOString()}.json`;
        a.click();
        toast.success('Backup downloaded successfully');
      } catch (error: any) {
        toast.error('Backup failed: ' + error.message);
      } finally {
        setLoading(false);
      }
    },
    getAllKeys: async () => {
      setLoading(true);
      try {
        const keys = await window.spark.kv.keys();
        setResults(`All KV Keys:\n${JSON.stringify(keys, null, 2)}`);
        toast.success(`Found ${keys.length} keys`);
      } catch (error: any) {
        toast.error('Failed to get keys: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <DatabaseIcon size={32} weight="duotone" className="text-primary" />
              <div>
                <CardTitle>SQL-Like Database Demo</CardTitle>
                <CardDescription>
                  Test CRUD operations on your QMT Operations database
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(queries).map(([key, query]) => (
            <Card key={key} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{query.name}</CardTitle>
                <CardDescription className="text-sm">
                  {query.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => runQuery(query.name, query.fn)}
                  disabled={loading}
                  className="w-full"
                  size="sm"
                >
                  <Play size={16} weight="fill" className="mr-2" />
                  Run Query
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Database Actions</CardTitle>
            <CardDescription>Backup, restore, and manage your database</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={actions.backup} disabled={loading} variant="secondary">
              <Download size={18} className="mr-2" />
              Download Backup
            </Button>
            <Button onClick={actions.getAllKeys} disabled={loading} variant="secondary">
              <DatabaseIcon size={18} className="mr-2" />
              Show All Keys
            </Button>
          </CardContent>
        </Card>

        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Query Results</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm">
                {results}
              </pre>
            </CardContent>
          </Card>
        )}

        <Card className="bg-accent/10">
          <CardHeader>
            <CardTitle>Quick Reference</CardTitle>
            <CardDescription>Common database operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <code className="bg-muted px-2 py-1 rounded">
                await Database.select('teams')
              </code>
              <span className="ml-2 text-muted-foreground">- Get all teams</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">
                await Database.select('teams', {'{ isActive: true }'})
              </code>
              <span className="ml-2 text-muted-foreground">- Filter with WHERE clause</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">
                await Database.insert('teams', newTeam)
              </code>
              <span className="ml-2 text-muted-foreground">- Insert new record</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">
                await Database.update('teams', id, updates)
              </code>
              <span className="ml-2 text-muted-foreground">- Update by ID</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">
                await Database.delete('teams', id)
              </code>
              <span className="ml-2 text-muted-foreground">- Delete by ID</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
