import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
import OperationsOffice from '@/components/OperationsOffice'
import { User } from '@/lib/types'

function App() {
  // Replace Spark's useKV with React's useState
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [view, setView] = useState<'dashboard' | 'office'>('dashboard')

  const handleSetUser = (user: User | null) => {
    setCurrentUser(user)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        currentUser={currentUser}
        onLogin={handleSetUser}
        onLogout={() => handleSetUser(null)}
        onNavigate={setView}
        currentView={view}
      />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {view === 'dashboard' ? (
          <Dashboard
            current            currentUser={currentUser}
            onLogin={handleSetUser}
            onNavigateToOffice={() => setView('office')}
          />
        ) : (
          <OperationsOffice
            currentUser={currentUser}
            onNavigateToDashboard={() => setView('dashboard')}
          />
        )}
      </main>
      <Toaster />
    </div>
  )
}
