import { useState, useEffect, lazy, Suspense } from 'react'
import { Toaster } from '@/components/ui/sonner'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
const OperationsOffice = lazy(() => import('@/components/OperationsOffice'))
import { User } from '@/lib/types'
import { getCurrentUser, logout, verifyToken } from '@/lib/auth'
import { useData } from '@/contexts/DataContext'
import { toast } from 'sonner'
import { CalendarBlank, CaretDown } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COLORS, SIZES, STYLES } from '@/lib/constants'

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

  const scheduleWindow = (
    <details className="group glass-card mb-6 text-card-foreground" style={{ borderRadius: SIZES.BORDER_RADIUS }}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[inherit] px-4 py-3 transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#248bcc] sm:px-5 [&::-webkit-details-marker]:hidden">
        <CalendarBlank size={SIZES.ICON_SIZE_MEDIUM} weight="duotone" className="shrink-0" style={{ color: COLORS.ACCENT }} aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
          <span className="text-sm font-semibold" style={{ color: COLORS.NAVY }}>Loaded schedule window</span>
          <span className="text-xs tabular-nums text-muted-foreground sm:text-sm">
            <time dateTime={eventWindow.from.slice(0, 10)} className="whitespace-nowrap">{eventWindow.from.slice(0, 10)}</time>
            {' to '}
            <time dateTime={eventWindow.to.slice(0, 10)} className="whitespace-nowrap">{eventWindow.to.slice(0, 10)}</time>
          </span>
        </span>
        <CaretDown size={SIZES.ICON_SIZE_SMALL} className="shrink-0 text-muted-foreground group-open:rotate-180 motion-safe:transition-transform" aria-hidden="true" />
      </summary>
      <form className="grid gap-4 border-t border-[#001f3f]/10 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:p-5" onSubmit={event => {
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
        <div className="space-y-2">
          <Label htmlFor="schedule-range-start" className="text-foreground">From</Label>
          <Input id="schedule-range-start" className="h-10" type="date" required value={rangeStart} onChange={event => setRangeStart(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-range-end" className="text-foreground">Through</Label>
          <Input id="schedule-range-end" className="h-10" type="date" required value={rangeEnd} onChange={event => setRangeEnd(event.target.value)} />
        </div>
        <Button className="w-full text-white sm:w-auto" style={{ ...STYLES.BUTTON_BASE, ...STYLES.NAVY_BUTTON }} type="submit" disabled={isLoading}>Load selected range</Button>
      </form>
    </details>
  )

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
              scheduleWindow={scheduleWindow}
            />
          ) : (
            <>
              {scheduleWindow}
              <Suspense fallback={<p role="status">Loading operations office...</p>}><OperationsOffice
                currentUser={currentUser!}
                onNavigateToDashboard={() => setView('dashboard')}
              /></Suspense>
            </>
          )}
        </main>
      </div>
    </>
  )
}

export default App
