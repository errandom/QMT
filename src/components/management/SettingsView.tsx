import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCircle, Crown, Star, Users } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { UsersTable } from './UsersTable';

export function SettingsView() {
  const { authState, isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <UserCircle size={30} weight="fill" className="text-primary" />
            </div>
            <div>
              <CardTitle>User Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground">
              {authState?.role === 'QMTadmin' ? (
                <Crown size={34} weight="duotone" />
              ) : (
                <Star size={34} weight="duotone" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{authState?.username}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={authState?.role === 'QMTadmin' ? 'default' : 'secondary'}>
                  {authState?.role === 'QMTadmin' ? 'Administrator' : 'Manager'}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role:</span>
                <span className="font-medium">{authState?.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access Level:</span>
                <span className="font-medium">
                  {authState?.role === 'QMTadmin' ? 'Full Access' : 'Management Access'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium text-green-600">Active</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users size={30} weight="fill" className="text-primary" />
              </div>
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage system users and permissions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <UsersTable />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>About QMT Ops</CardTitle>
          <CardDescription>Application information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
          <p><strong>Environment:</strong> Production</p>
        </CardContent>
      </Card>
    </div>
  );
}
