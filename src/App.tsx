import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
import OperationsOffice from '@/components/OperationsOffice'
import { User } from '@/lib/types'
import { getCurrentUser, logout } from '@/lib/auth'

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [view, setView] = useState<'dashboard' | 'office'>('dashboard')

  // Restore user from token on mount
  useEffect(() => {
    const user = getCurrentUser()
    if (user) {
      setCurrentUser(user)
    }
  }, [])

  const handleSetUser = (user: User | null) => {
    setCurrentUser(user)
  }

  const handleLogout = () => {
    logout()
    setCurrentUser(null)
    setView('dashboard')
  }

  return (
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
      <Toaster />
    </div>
  )
}

export default App
