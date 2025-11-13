import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SignIn, SignOut, Crown, Detective } from '@phosphor-icons/react'
import LoginDialog from './LoginDialog'
import { User } from '@/lib/types'
import { hasAccess } from '@/lib/auth'

interface HeaderProps {
  currentUser: User | null
  onLogin: (user: User) => void
  onLogout: () => void
  onNavigate: (view: 'dashboard' | 'office') => void
  currentView: 'dashboard' | 'office'
}

export default function Header({ currentUser, onLogin, onLogout, onNavigate, currentView }: HeaderProps) {
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  const handleOfficeClick = () => {
    if (currentUser && hasAccess(currentUser)) {
      onNavigate('office')
    } else {
      setShowLoginDialog(true)
    }
  }

  const handleLoginSuccess = (user: User) => {
    onLogin(user)
    setShowLoginDialog(false)
    if (hasAccess(user)) {
      onNavigate('office')
    }
  }

  const getRoleIcon = (role: string) => {
    if (role === 'admin') {
      return (
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
          <Crown size={24} weight="thin" className="text-foreground" />
        </div>
      )
    }
    if (role === 'mgmt') {
      return (
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
          <Detective size={24} weight="thin" className="text-foreground" />
        </div>
      )
    }
    return null
  }

  return (
    <>
      <header className="bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500 text-white shadow-lg shadow-slate-800/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">QMT | Operations</h1>
              <p className="text-sm text-white/90 tracking-wide">ZURICH RENEGADES FOOTBALL</p>
            </div>
            
            <div className="flex items-center gap-3">
              {currentUser ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getRoleIcon(currentUser.role)}
                    <span className="text-sm font-medium hidden sm:inline">{currentUser.username}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="text-white hover:bg-white/10"
                  >
                    <SignOut size={18} weight="bold" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOfficeClick}
                  className="text-white hover:bg-white/10"
                >
                  <SignIn className="mr-2" size={18} weight="bold" />
                  Office
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  )
}