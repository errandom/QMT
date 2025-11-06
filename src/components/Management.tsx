import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { SignOut } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/use-auth';
import { TeamsTable } from './management/TeamsTable';
import { SitesTable } from './management/SitesTable';
import { FieldsTable } from './management/FieldsTable';
import { ScheduleTable } from './management/ScheduleTable';
import { RequestsTable } from './management/RequestsTable';
import { UsersTable } from './management/UsersTable';

interface ManagementProps {
  onLogout: () => void;
}

export function Management({ onLogout }: ManagementProps) {
  const { authState, logout, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('teams');

  const handleLogout = () => {
    logout();
    onLogout();
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold text-sm">
                  {authState?.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-primary-foreground font-medium">{authState?.username}</span>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleLogout} 
                className="gap-2 text-primary-foreground hover:bg-white/10"
              >
                <SignOut size={18} />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">Management Console</h2>
          <p className="text-muted-foreground">
            Logged in as: <span className="font-semibold text-foreground">{authState?.username}</span> ({authState?.role})
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-6 bg-card shadow-lg p-1.5 h-auto">
            <TabsTrigger value="teams" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground">Teams</TabsTrigger>
            <TabsTrigger value="sites" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground">Sites</TabsTrigger>
            <TabsTrigger value="fields" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground">Fields</TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground">Schedule</TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground">Requests</TabsTrigger>
            {isAdmin && <TabsTrigger value="users" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground">Users</TabsTrigger>}
          </TabsList>

          <TabsContent value="teams">
            <TeamsTable />
          </TabsContent>

          <TabsContent value="sites">
            <SitesTable />
          </TabsContent>

          <TabsContent value="fields">
            <FieldsTable />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleTable />
          </TabsContent>

          <TabsContent value="requests">
            <RequestsTable />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="users">
              <UsersTable />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
