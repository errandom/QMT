import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
import OperationsOffice from '@/components/OperationsOffice'
import { User } from '@/lib/types'
import { getCurrentUser, logout, verifyToken } from '@/lib/auth'

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [view, setView] = useState<'dashboard' | 'office'>('dashboard')
  const [isVerifyingSession, setIsVerifyingSession] = useState(true)

  // Restore and verify user session on mount
  useEffect(() => {
    async function restoreSession() {
      const user = getCurrentUser()
      if (user) {
        // Verify the token is still valid with the server
        const isValid = await verifyToken()
        if (isValid) {
          setCurrentUser(user)
        }
        // If invalid, verifyToken already clears the stored credentials
      }
      setIsVerifyingSession(false)
    }
    restoreSession()
  }, [])

  const handleSetUser = (user: User | null) => {
    setCurrentUser(user)
  }

  const handleLogout = () => {
    logout()
    setCurrentUser(null)
    setView('dashboard')
  }

  // Show loading state while verifying session
  if (isVerifyingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-background">
        <Header 
          currentUser={currentUser}
          onLogin={handleSetUser}
          onLogout={handleLogout}
          onNavigate={setView}
          currentView={view}
        />
        <main className="container mx-auto px-4 py-6 max-w-7xl">
          {view === 'dashboard' ? (
            <Dashboard 
              currentUser={currentUser} 
              onLogin={handleSetUser}
              onNavigateToOffice={() => setView('office')}
            />
          ) : (
            <OperationsOffice 
              currentUser={currentUser!} 
              onNavigateToDashboard={() => setView('dashboard')}
            />
          )}
        </main>
      </div>
    </>
  )
}

export default App
