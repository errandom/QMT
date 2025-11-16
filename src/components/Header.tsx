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

  const getRoleIcon = (role: string, isMobile = false) => {
    const sizeClass = isMobile ? 'w-8 h-8' : 'w-10 h-10'
    const iconSize = isMobile ? 20 : 24
    
    if (role === 'admin') {
      return (
        <div className={`${sizeClass} rounded-full bg-white flex items-center justify-center`}>
          <Crown size={iconSize} weight="duotone" style={{ color: '#248bcc' }} />
        </div>
      )
    }
    if (role === 'mgmt') {
      return (
        <div className={`${sizeClass} rounded-full bg-white flex items-center justify-center`}>
          <Detective size={iconSize} weight="duotone" style={{ color: '#248bcc' }} />
        </div>
      )
    }
    return null
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/30 backdrop-blur-sm" style={{
        background: '#001f3f',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
      }}>
        <div className="container mx-auto px-4 py-3 sm:py-5 max-w-7xl">
          <div className="flex items-start justify-between sm:items-center">
            <div className="flex-1 pr-3">
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg" style={{letterSpacing: '0.095em'}}>QMT | Operations</h1>
              <p className="text-sm text-white/95 tracking-[0.095em] font-medium">ZURICH RENEGADES FOOTBALL</p>
            </div>
            
            <div className="flex items-center gap-3 sm:flex-row">
              {currentUser ? (
                <>
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(currentUser.role)}
                      <span className="text-sm font-medium text-white drop-shadow-sm">{currentUser.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onLogout}
                      className="group text-white hover:bg-white/15 transition-all rounded-lg"
                    >
                      <SignOut size={18} weight="bold" style={{ color: '#f5f5f5' }} />
                    </Button>
                  </div>
                  
                  <div className="flex sm:hidden flex-col items-center gap-2">
                    {getRoleIcon(currentUser.role, true)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onLogout}
                      className="group text-white hover:bg-white/15 transition-all rounded-lg h-7 px-2"
                    >
                      <SignOut size={16} weight="bold" style={{ color: '#f5f5f5' }} />
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOfficeClick}
                  className="group text-white hover:bg-[#001f3f]/80 transition-all rounded-lg bg-[#001f3f]"
                >
                  <SignIn className="mr-2" size={18} weight="bold" style={{ color: '#f5f5f5' }} />
                  <span>Office</span>
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