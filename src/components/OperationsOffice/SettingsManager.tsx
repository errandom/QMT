import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { User, UserRole } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, PencilSimple, UserCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { DEFAULT_USER } from '@/lib/auth'

interface SettingsManagerProps {
  currentUser: User
}

export default function SettingsManager({ currentUser }: SettingsManagerProps) {
  const [users = [DEFAULT_USER], setUsers] = useKV<User[]>('users', [DEFAULT_USER])
  const [showDialog, setShowDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    password: '',
    role: 'user',
    isActive: true
  })

  const handleCreate = () => {
    setEditingUser(null)
    setFormData({
      username: '',
      password: '',
      role: 'user',
      isActive: true
    })
    setShowDialog(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData(user)
    setShowDialog(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingUser) {
      setUsers((current = [DEFAULT_USER]) =>
        current.map(u => u.id === editingUser.id ? { ...formData, id: editingUser.id } as User : u)
      )
      toast.success('User updated successfully')
    } else {
      const newUser: User = {
        ...formData,
        id: `user-${Date.now()}`
      } as User
      
      setUsers((current = [DEFAULT_USER]) => [...current, newUser])
      toast.success('User created successfully')
    }
    
    setShowDialog(false)
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
            <div>
              <div className="font-semibold">{currentUser.username}</div>
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
                <p className="text-sm text-muted-foreground">Manage system users and their roles</p>
              </div>
              <Button onClick={handleCreate}>
                <Plus className="mr-2" size={16} />
                Add User
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {users.map((user) => (
                <Card key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <UserCircle size={16} />
                          {user.username}
                        </CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="secondary" className="text-xs">{user.role}</Badge>
                          <Badge variant={user.isActive ? 'default' : 'destructive'} className="text-xs">
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(user)}
                        disabled={user.id === DEFAULT_USER.id}
                      >
                        <PencilSimple size={16} />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit User' : 'Create User'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    disabled={editingUser?.id === DEFAULT_USER.id}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    placeholder={editingUser ? 'Leave blank to keep current' : ''}
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

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    disabled={editingUser?.id === DEFAULT_USER.id}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingUser ? 'Update' : 'Create'}
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