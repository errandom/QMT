import { useState, useEffect, lazy, Suspense } from 'react'
import { Toaster } from '@/components/ui/sonner'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
const OperationsOffice = lazy(() => import('@/components/OperationsOffice'))
import { User } from '@/lib/types'
import { getCurrentUser, logout, verifyToken } from '@/lib/auth'
import { useData } from '@/contexts/DataContext'
import { toast } from 'sonner'

function App() {
  const { refreshRequests, clearRequests, refreshData, eventWindow, isLoading } = useData()
  const [rangeStart, setRangeStart] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
  const [rangeEnd, setRangeEnd] = useState(new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10))
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [view, setView] = useState<'dashboard' | 'office'>('dashboard')
  const [isVerifyingSession, setIsVerifyingSession] = useState(true)
  useEffect(() => {
    void refreshData()
    if (currentUser && ['admin', 'mgmt'].includes(currentUser.role)) {
      void refreshRequests().catch(() => toast.error('Requests could not be loaded. Refresh before managing requests.'))
    } else clearRequests()
    return clearRequests
  }, [currentUser, refreshRequests, clearRequests, refreshData])

  // Restore and verify user session on mount
  useEffect(() => {
    async function restoreSession() {
      const user = getCurrentUser()
      if (user) {
        // Verify the token is still valid with the server
        const isValid = await verifyToken()
        if (isValid) {
          setCurrentUser(getCurrentUser())
        }
        await refreshData()
        // If invalid, verifyToken already clears the stored credentials
      }
      setIsVerifyingSession(false)
    }
    restoreSession()
  }, [refreshData])

  const handleSetUser = (user: User | null) => {
    setCurrentUser(user)
    void refreshData()
  }

  const handleLogout = () => {
    logout()
    setCurrentUser(null)
    clearRequests()
    void refreshData()
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
          <details className="mb-4 rounded border p-3">
            <summary>Loaded schedule window: {eventWindow.from.slice(0, 10)} to {eventWindow.to.slice(0, 10)}</summary>
            <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={event => {
              event.preventDefault()
              const from = new Date(`${rangeStart}T00:00:00Z`)
              const to = new Date(`${rangeEnd}T00:00:00Z`)
              to.setUTCDate(to.getUTCDate() + 1)
              if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())
                  || to <= from || to.getTime() - from.getTime() > 366 * 86400000) {
                toast.error('Select a valid date range of at most 366 days')
                return
              }
              void refreshData({ from: from.toISOString(), to: to.toISOString() })
            }}>
              <label>From <input className="rounded border p-2" type="date" required value={rangeStart} onChange={event => setRangeStart(event.target.value)} /></label>
              <label>Through <input className="rounded border p-2" type="date" required value={rangeEnd} onChange={event => setRangeEnd(event.target.value)} /></label>
              <button className="rounded border p-2" type="submit" disabled={isLoading}>Load selected range</button>
            </form>
          </details>
          {view === 'dashboard' ? (
            <Dashboard 
              currentUser={currentUser} 
              onLogin={handleSetUser}
              onNavigateToOffice={() => setView('office')}
            />
          ) : (
            <Suspense fallback={<p role="status">Loading operations office...</p>}><OperationsOffice
              currentUser={currentUser!} 
              onNavigateToDashboard={() => setView('dashboard')}
            /></Suspense>
          )}
        </main>
      </div>
    </>
  )
}

export default App
