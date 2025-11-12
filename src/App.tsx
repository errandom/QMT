import React from 'react';
import { useTeams, useSites, useFields, useSchedule, useRequests, useUsers } from './hooks/use-data';
import { useAuth } from './hooks/use-auth';
import Dashboard from './components/Dashboard';
import Management from './components/Management';
import DatabaseDemo from './components/DatabaseDemo';
import { ErrorFallback } from './ErrorFallback';

function App() {
  const { teams, loading: teamsLoading, error: teamsError } = useTeams();
  const { sites, loading: sitesLoading, error: sitesError } = useSites();
  const { fields, loading: fieldsLoading, error: fieldsError } = useFields();
  const { schedule, loading: scheduleLoading, error: scheduleError } = useSchedule();
  const { requests, loading: requestsLoading, error: requestsError } = useRequests();
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const { authState, login, logout, isAdmin } = useAuth();

  const loading =
    teamsLoading ||
    sitesLoading ||
    fieldsLoading ||
    scheduleLoading ||
    requestsLoading ||
    usersLoading;

  const error =
    teamsError ||
    sitesError ||
    fieldsError ||
    scheduleError ||
    requestsError ||
    usersError;

  if (loading) {
    return <div className="p-8 text-center">Loading data from SQL database...</div>;
  }

  if (error) {
    return <ErrorFallback error={error} resetErrorBoundary={() => window.location.reload()} />;
  }

  return (
    <div>
      <Dashboard
        teams={teams}
        sites={sites}
        fields={fields}
        schedule={schedule}
        requests={requests}
        users={users}
        authState={authState}
        login={login}
        logout={logout}
        isAdmin={isAdmin}
      />
      <Management
        teams={teams}
        sites={sites}
        fields={fields}
        schedule={schedule}
        requests={requests}
        users={users}
        authState={authState}
        login={login}
        logout={logout}
        isAdmin={isAdmin}
      />
      <DatabaseDemo />
    </div>
  );
}
export default App;
