import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { Management } from './components/Management';
import { LoginDialog } from './components/LoginDialog';
import { RequestDialog } from './components/RequestDialog';
import { useAuth } from './hooks/use-auth';
import { Toaster } from './components/ui/sonner';

function App() {
  const [isSparkReady, setIsSparkReady] = useState(false);
  const { authState } = useAuth();
  const [view, setView] = useState<'dashboard' | 'management'>('dashboard');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showFacilityRequest, setShowFacilityRequest] = useState(false);
  const [showEquipmentRequest, setShowEquipmentRequest] = useState(false);

  useEffect(() => {
    const checkSparkRuntime = () => {
      if (typeof window !== 'undefined' && window.spark?.kv) {
        setIsSparkReady(true);
      } else {
        setTimeout(checkSparkRuntime, 100);
      }
    };
    checkSparkRuntime();
  }, []);

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

  if (!isSparkReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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