import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Management } from './components/Management';
import { LoginDialog } from './components/LoginDialog';
import { RequestDialog } from './components/RequestDialog';
import { useAuth } from './hooks/use-auth';
import { Toaster } from './components/ui/sonner';

function App() {
  const { authState } = useAuth();
  const [view, setView] = useState<'dashboard' | 'management'>('dashboard');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showFacilityRequest, setShowFacilityRequest] = useState(false);
  const [showEquipmentRequest, setShowEquipmentRequest] = useState(false);

  const handleManagementClick = () => {
    if (authState?.isAuthenticated) {
      setView('management');
    } else {
      setShowLoginDialog(true);
    }
  };

  const handleLoginSuccess = () => {
    setView('management');
  };

  const handleLogout = () => {
    setView('dashboard');
  };

  return (
    <>
      {view === 'dashboard' ? (
        <Dashboard
          onRequestFacility={() => setShowFacilityRequest(true)}
          onRequestEquipment={() => setShowEquipmentRequest(true)}
          onManagement={handleManagementClick}
          onLogout={handleLogout}
          onLogin={() => setShowLoginDialog(true)}
        />
      ) : (
        <Management onLogout={handleLogout} />
      )}

      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        onSuccess={handleLoginSuccess}
      />

      <RequestDialog
        open={showFacilityRequest}
        onOpenChange={setShowFacilityRequest}
        type="facility"
      />

      <RequestDialog
        open={showEquipmentRequest}
        onOpenChange={setShowEquipmentRequest}
        type="equipment"
      />

      <Toaster />
    </>
  );
}

export default App;