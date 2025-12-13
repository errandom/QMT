import { useState } from 'react'
import { User, UserRole } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, UserCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface SettingsManagerProps {
  currentUser: User
}

export default function SettingsManager({ currentUser }: SettingsManagerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user' as UserRole,
    email: '',
    fullName: ''
  })

  const handleCreate = () => {
    setFormData({
      username: '',
      password: '',
      role: 'user',
      email: '',
      fullName: ''
    })
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      await api.register({
        username: formData.username,
        password: formData.password,
        role: formData.role,
        email: formData.email || undefined,
        fullName: formData.fullName || undefined
      })
      
      toast.success('User created successfully')
      setShowDialog(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isAdmin = currentUser.role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account and user settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {currentUser.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="font-semibold">{currentUser.username}</div>
              {currentUser.fullName && (
                <div className="text-sm text-muted-foreground">{currentUser.fullName}</div>
              )}
              {currentUser.email && (
                <div className="text-sm text-muted-foreground">{currentUser.email}</div>
              )}
              <Badge variant="secondary">{currentUser.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">User Management</h3>
                <p className="text-sm text-muted-foreground">Create new system users (Admin only)</p>
              </div>
              <Button onClick={handleCreate}>
                <Plus className="mr-2" size={16} />
                Add User
              </Button>
            </div>

            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-center text-muted-foreground">
                  <UserCircle size={24} className="mr-2" />
                  <span>User list requires backend API integration</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v as UserRole })}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="mgmt">Management</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
