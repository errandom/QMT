import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { authenticateUser } from '@/lib/auth'
import { User } from '@/lib/types'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoginSuccess: (user: User) => void
}

export default function LoginDialog({ open, onOpenChange, onLoginSuccess }: LoginDialogProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const user = authenticateUser(username, password)
    
    if (user) {
      toast.success('Login successful')
      onLoginSuccess(user)
      setUsername('')
      setPassword('')
    } else {
      toast.error('Invalid credentials')
    }
    
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Operations Office Login</DialogTitle>
          <DialogDescription>
            Enter your credentials to access the operations office
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} style={{
              borderColor: '#001f3f',
              color: '#2c3e50'
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} style={{
              background: 'linear-gradient(90deg, #001f3f 0%, #248bcc 100%)',
              color: '#f5f5f5'
            }}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}