import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Gear, UserCircle, ShieldStar, UserCircleGear } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';

export function SettingsView() {
  const { authState } = useAuth();

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <UserCircle size={28} weight="fill" className="text-primary" />
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
                <ShieldStar size={32} weight="fill" />
              ) : (
                <UserCircleGear size={32} weight="fill" />
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Gear size={28} weight="fill" className="text-primary" />
            </div>
            <div>
              <CardTitle>Application Settings</CardTitle>
              <CardDescription>Configure your organization settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                defaultValue="ZURICH RENEGADES FOOTBALL"
                placeholder="Enter organization name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-tagline">Tagline</Label>
              <Input
                id="org-tagline"
                defaultValue="Quick Mean Tough | Operations"
                placeholder="Enter tagline"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-email">Contact Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="contact@zurich-renegades.ch"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-phone">Contact Phone</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  placeholder="+41 XX XXX XX XX"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} className="gap-2">
              <Gear size={18} weight="fill" />
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

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
