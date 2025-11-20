import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, setToken, setStoredUser } from '@/lib/api'
import { User } from '@/lib/types'
import { CheckCircle, XCircle } from '@phosphor-icons/react'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoginSuccess: (user: User) => void
}

export default function LoginDialog({ open, onOpenChange, onLoginSuccess }: LoginDialogProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setFeedback(null)

    try {
      const response = await api.login(username, password)
      
      // Store token and user data
      setToken(response.token)
      setStoredUser(response.user)
      
      setFeedback({ type: 'success', message: 'Login successful' })
      
      // Convert API user to app User type
      const user: User = {
        id: response.user.id.toString(),
        username: response.user.username,
        password: '', // Don't store password
        role: response.user.role,
        isActive: true
      }
      
      setTimeout(() => {
        onLoginSuccess(user)
        setUsername('')
        setPassword('')
        setFeedback(null)
      }, 800)
    } catch (error: any) {
      setFeedback({ type: 'error', message: error.message || 'Invalid credentials' })
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] p-6"
        style={{
          background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(162, 218, 245, 0.92) 100%)',
          backdropFilter: 'blur(16px)'
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: '#001f3f' }}>Operations Office Login</DialogTitle>
          <DialogDescription style={{ color: '#001f3f', opacity: 0.8 }}>
            Enter your credentials to access the operations office
          </DialogDescription>
        </DialogHeader>
        
        {feedback && (
          <div 
            className="flex items-center gap-2 p-3 rounded-md mt-4"
            style={{
              backgroundColor: feedback.type === 'success' 
                ? 'oklch(0.85 0.15 150)' 
                : 'oklch(0.45 0.22 25)',
              color: 'white',
              border: `1px solid ${feedback.type === 'success' ? 'oklch(0.75 0.18 150)' : 'oklch(0.35 0.25 25)'}`
            }}
          >
            {feedback.type === 'success' ? (
              <CheckCircle size={20} weight="fill" />
            ) : (
              <XCircle size={20} weight="fill" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              style={{
                borderColor: '#3e4347',
                backgroundColor: 'white',
                color: '#3e4347'
              }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              style={{
                backgroundColor: '#248bcc',
                color: 'white',
                border: 'none'
              }}
              className="hover:opacity-90"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}