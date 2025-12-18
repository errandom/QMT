import { useState, useEffect } from 'react'
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
import { Plus, UserCircle, Trash, PencilSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { COLORS } from '@/lib/constants'

interface SettingsManagerProps {
  currentUser: User
}

export default function SettingsManager({ currentUser }: SettingsManagerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user' as UserRole,
    email: '',
    fullName: ''
  })

  // Fetch users on mount if admin
  useEffect(() => {
    if (currentUser.role === 'admin') {
      fetchUsers()
    }
  }, [])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch users')
    } finally {
      setLoadingUsers(false)
    }
  }

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
      fetchUsers() // Refresh the user list
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

            {loadingUsers ? (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center justify-center text-muted-foreground">
                    <span>Loading users...</span>
                  </div>
                </CardContent>
              </Card>
            ) : users.length === 0 ? (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center justify-center text-muted-foreground">
                    <UserCircle size={24} className="mr-2" />
                    <span>No users found</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => (
                  <Card key={user.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {user.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-sm">{user.username}</CardTitle>
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {user.role}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      {user.full_name && (
                        <div className="text-xs" style={{ color: COLORS.CHARCOAL }}>
                          <span className="text-muted-foreground">Name: </span>
                          {user.full_name}
                        </div>
                      )}
                      {user.email && (
                        <div className="text-xs" style={{ color: COLORS.CHARCOAL }}>
                          <span className="text-muted-foreground">Email: </span>
                          {user.email}
                        </div>
                      )}
                      <div className="flex items-center gap-1 pt-2">
                        <Badge variant={user.is_active ? 'default' : 'destructive'} className="text-xs">
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
                      <SelectValue placeholder="Select role" />
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
