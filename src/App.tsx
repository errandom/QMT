import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
import OperationsOffice from '@/components/OperationsOffice'
import { useKV } from '@github/spark/hooks'
import { User } from '@/lib/types'

function App() {
  const [currentUser, setCurrentUser] = useKV<User | null>('current-user', null)
  const [view, setView] = useState<'dashboard' | 'office'>('dashboard')

  const handleSetUser = (user: User | null) => {
    setCurrentUser(user)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        currentUser={currentUser || null}
        onLogin={handleSetUser}
        onLogout={() => handleSetUser(null)}
        onNavigate={setView}
        currentView={view}
      />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {view === 'dashboard' ? (
          <Dashboard 
            currentUser={currentUser || null} 
            onLogin={handleSetUser}
            onNavigateToOffice={() => setView('office')}
          />
        ) : (
          <OperationsOffice 
            currentUser={currentUser || null} 
            onNavigateToDashboard={() => setView('dashboard')}
          />
        )}
      </main>
      <Toaster />
    </div>
  )
}

export default App