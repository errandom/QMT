import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CalendarBlank, ClipboardText, Users, Cube, MapPin, GridFour, Gear } from '@phosphor-icons/react'
import { User } from '@/lib/types'
import { hasAccess } from '@/lib/auth'
import ScheduleManager from './OperationsOffice/ScheduleManager'
import RequestsManager from './OperationsOffice/RequestsManager'
import TeamsManager from './OperationsOffice/TeamsManager'
import EquipmentManager from './OperationsOffice/EquipmentManager'
import FieldsManager from './OperationsOffice/FieldsManager'
import SitesManager from './OperationsOffice/SitesManager'
import SettingsManager from './OperationsOffice/SettingsManager'

interface OperationsOfficeProps {
  currentUser: User | null
  onNavigateToDashboard: () => void
}

export default function OperationsOffice({ currentUser, onNavigateToDashboard }: OperationsOfficeProps) {
  const [activeTab, setActiveTab] = useState('schedule')

  if (!currentUser || !hasAccess(currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Alert className="max-w-md">
          <AlertDescription>
            Access denied. You need admin or management privileges to access the Operations Office.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operations Office</h1>
          <p className="text-muted-foreground">Manage schedules, requests, teams, and facilities</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="schedule">
            <CalendarBlank className="mr-2" size={18} weight="duotone" />
            <span className="hidden sm:inline">Schedule</span>
          </TabsTrigger>
          <TabsTrigger value="requests">
            <ClipboardText className="mr-2" size={18} weight="duotone" />
            <span className="hidden sm:inline">Requests</span>
          </TabsTrigger>
          <TabsTrigger value="teams">
            <Users className="mr-2" size={18} weight="duotone" />
            <span className="hidden sm:inline">Teams</span>
          </TabsTrigger>
          <TabsTrigger value="equipment">
            <Cube className="mr-2" size={18} weight="duotone" />
            <span className="hidden sm:inline">Equipment</span>
          </TabsTrigger>
          <TabsTrigger value="fields">
            <GridFour className="mr-2" size={18} weight="duotone" />
            <span className="hidden sm:inline">Fields</span>
          </TabsTrigger>
          <TabsTrigger value="sites">
            <MapPin className="mr-2" size={18} weight="duotone" />
            <span className="hidden sm:inline">Sites</span>
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Gear className="mr-2" size={18} weight="duotone" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <ScheduleManager />
        </TabsContent>

        <TabsContent value="requests">
          <RequestsManager currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="teams">
          <TeamsManager />
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentManager />
        </TabsContent>

        <TabsContent value="fields">
          <FieldsManager />
        </TabsContent>

        <TabsContent value="sites">
          <SitesManager />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsManager currentUser={currentUser} />
        </TabsContent>
      </Tabs>
    </div>
  )
}