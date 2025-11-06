import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SignOut, CalendarBlank, Football, Gear, ArrowLeft, ShieldStar, UserCircleGear } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/use-auth';
import { TeamsTable } from './management/TeamsTable';
import { SitesTable } from './management/SitesTable';
import { FieldsTable } from './management/FieldsTable';
import { ScheduleTable } from './management/ScheduleTable';
import { RequestsTable } from './management/RequestsTable';
import { UsersTable } from './management/UsersTable';
import { SettingsView } from './management/SettingsView';
import { ChecklistIcon } from './icons/ChecklistIcon';
import { FootballPlayerIcon } from './icons/FootballPlayerIcon';
import { TacklePadsIcon } from './icons/TacklePadsIcon';
import { FieldIcon } from './icons/FieldIcon';
import { ArenaIcon } from './icons/ArenaIcon';

interface ManagementProps {
  onLogout: () => void;
}

export function Management({ onLogout }: ManagementProps) {
  const { authState, logout, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('schedule');

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const handleBackToDashboard = () => {
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="bg-gradient-to-r from-primary via-primary/95 to-secondary shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-primary-foreground tracking-tight">
                  QMT | Operations
                </h1>
                <p className="text-primary-foreground/90 text-sm md:text-base font-bold mt-1">
                  ZURICH RENEGADES FOOTBALL
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground">
                  {authState?.role === 'QMTadmin' ? (
                    <ShieldStar size={20} weight="fill" />
                  ) : (
                    <UserCircleGear size={20} weight="fill" />
                  )}
                </div>
                <span className="text-primary-foreground font-medium hidden md:inline">{authState?.username}</span>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleLogout} 
                className="gap-2 text-primary-foreground hover:bg-white/10"
              >
                <SignOut size={18} />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <div></div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleBackToDashboard}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft size={20} weight="bold" />
              Back to Dashboard
            </Button>
            <Button 
              onClick={() => setActiveTab('settings')}
              variant="outline"
              className="gap-2"
            >
              <Gear size={20} weight="fill" />
              Settings
            </Button>
          </div>
        </div>

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
                  <CalendarBlank size={30} weight={activeTab === 'schedule' ? 'fill' : 'regular'} />
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
                  <ChecklistIcon size={30} filled={activeTab === 'requests'} />
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
                  <FootballPlayerIcon size={30} filled={activeTab === 'teams'} />
                </div>
              </div>
              <CardTitle className="text-base">Teams</CardTitle>
            </CardHeader>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
              activeTab === 'equipment' ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
            onClick={() => setActiveTab('equipment')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-xl ${
                  activeTab === 'equipment' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <TacklePadsIcon size={30} filled={activeTab === 'equipment'} />
                </div>
              </div>
              <CardTitle className="text-base">Equipment</CardTitle>
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
                  <FieldIcon size={30} />
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
                  <ArenaIcon size={30} filled={activeTab === 'sites'} />
                </div>
              </div>
              <CardTitle className="text-base">Sites</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="teams">
            <TeamsTable />
          </TabsContent>

          <TabsContent value="equipment">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Equipment management coming soon...</p>
            </div>
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

          <TabsContent value="settings">
            <SettingsView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
