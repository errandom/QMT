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
      <header className="sticky top-0 z-50 border-b border-white/20" style={{
        background: 'linear-gradient(135deg, oklch(0.45 0.18 240) 0%, oklch(0.55 0.20 220) 25%, oklch(0.60 0.18 210) 50%, oklch(0.50 0.22 200) 75%, oklch(0.52 0.20 210) 100%)',
        boxShadow: '0 4px 16px oklch(0.30 0.10 220 / 0.2)'
      }}>
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg" style={{letterSpacing: '0.095em'}}>QMT | Operations</h1>
              <p className="text-sm text-white/95 tracking-[0.095em] font-medium">ZURICH RENEGADES FOOTBALL</p>
            </div>
            
            <div className="flex items-center gap-3">
              {currentUser ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getRoleIcon(currentUser.role)}
                    <span className="text-sm font-medium hidden sm:inline text-white">{currentUser.username}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="text-white hover:bg-white/10 transition-all"
                  >
                    <SignOut size={18} weight="bold" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOfficeClick}
                  className="text-white hover:bg-white/10 transition-all"
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