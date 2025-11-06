import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SignOut, CalendarBlank, ListChecks, Users, Buildings } from '@phosphor-icons/react';
import { GridironIcon } from '@/components/icons/GridironIcon';
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
        <div className="mb-8">
          <h2 className="text-4xl font-bold mb-2">Operations Office</h2>
          <p className="text-muted-foreground text-lg">
            Quick - Mean - Tough | On and Off the Field
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card 
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
              activeTab === 'schedule' ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
            onClick={() => setActiveTab('schedule')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-xl ${
                  activeTab === 'schedule' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <CalendarBlank size={28} weight="fill" />
                </div>
              </div>
              <CardTitle className="text-base">Schedule</CardTitle>
            </CardHeader>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
              activeTab === 'requests' ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
            onClick={() => setActiveTab('requests')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-xl ${
                  activeTab === 'requests' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <ListChecks size={28} weight="fill" />
                </div>
              </div>
              <CardTitle className="text-base">Requests</CardTitle>
            </CardHeader>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
              activeTab === 'teams' ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
            onClick={() => setActiveTab('teams')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-xl ${
                  activeTab === 'teams' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <Users size={28} weight="fill" />
                </div>
              </div>
              <CardTitle className="text-base">Teams</CardTitle>
            </CardHeader>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
              activeTab === 'fields' ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
            onClick={() => setActiveTab('fields')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-xl ${
                  activeTab === 'fields' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <GridironIcon size={28} />
                </div>
              </div>
              <CardTitle className="text-base">Fields</CardTitle>
            </CardHeader>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
              activeTab === 'sites' ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
            onClick={() => setActiveTab('sites')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-xl ${
                  activeTab === 'sites' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <Buildings size={28} weight="fill" />
                </div>
              </div>
              <CardTitle className="text-base">Sites</CardTitle>
            </CardHeader>
          </Card>

          {isAdmin && (
            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
                activeTab === 'users' ? 'ring-2 ring-primary shadow-lg' : ''
              }`}
              onClick={() => setActiveTab('users')}
            >
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3">
                  <div className={`p-3 rounded-xl ${
                    activeTab === 'users' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Users size={28} weight="duotone" />
                  </div>
                </div>
                <CardTitle className="text-base">Users</CardTitle>
              </CardHeader>
            </Card>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
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
