import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SignIn, SignOut, House } from '@phosphor-icons/react'
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

  return (
    <>
      <header className="bg-gradient-to-r from-primary via-accent to-secondary text-primary-foreground shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">QMT | Operations</h1>
              <p className="text-sm text-primary-foreground/90 tracking-wide">ZURICH RENEGADES FOOTBALL</p>
            </div>
            
            <div className="flex items-center gap-3">
              {currentView === 'office' && currentUser && hasAccess(currentUser) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate('dashboard')}
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <House className="mr-2" size={18} />
                  Dashboard
                </Button>
              )}
              
              {currentUser ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9 border-2 border-primary-foreground/20">
                      <AvatarFallback className="bg-primary-foreground/10 text-primary-foreground font-semibold">
                        {currentUser.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium hidden sm:inline">{currentUser.username}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    <SignOut size={18} />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOfficeClick}
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <SignIn className="mr-2" size={18} />
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