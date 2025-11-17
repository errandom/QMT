import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CalendarBlank, ClipboardText, Users, Cube, MapPin, GridFour, Gear, ArrowLeft } from '@phosphor-icons/react'
import { User, FacilityRequest, EquipmentRequest, CancellationRequest } from '@/lib/types'
import { hasAccess } from '@/lib/auth'
import { useKV } from '@github/spark/hooks'
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
  const [facilityRequests = []] = useKV<FacilityRequest[]>('facility-requests', [])
  const [equipmentRequests = []] = useKV<EquipmentRequest[]>('equipment-requests', [])
  const [cancellationRequests = []] = useKV<CancellationRequest[]>('cancellation-requests', [])

  const hasUnresolvedRequests = 
    facilityRequests.some(r => r.status === 'Pending') ||
    equipmentRequests.some(r => r.status === 'Pending') ||
    cancellationRequests.some(r => r.status === 'Pending')

  const tabOptions = [
    { value: 'schedule', icon: CalendarBlank, label: 'Schedule' },
    { value: 'requests', icon: ClipboardText, label: 'Requests', hasNotification: hasUnresolvedRequests },
    { value: 'teams', icon: Users, label: 'Teams' },
    { value: 'equipment', icon: Cube, label: 'Equipment' },
    { value: 'fields', icon: GridFour, label: 'Fields' },
    { value: 'sites', icon: MapPin, label: 'Sites' },
    { value: 'settings', icon: Gear, label: 'Settings' }
  ]

  const activeIndex = tabOptions.findIndex(opt => opt.value === activeTab)

  if (!currentUser || !hasAccess(currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Alert className="max-w-md glass-card border-white/20">
          <AlertDescription className="text-white">
            Access denied. You need admin or management privileges to access the Operations Office.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-[oklch(0.28_0.08_240)] drop-shadow-lg">Operations Office</h1>
          <button 
            onClick={onNavigateToDashboard}
            className="group flex items-center gap-2 text-[#248bcc] hover:text-[#1a6a9a] transition-colors shrink-0 font-medium"
          >
            <ArrowLeft className="group-hover:-translate-x-0.5 transition-transform duration-200" size={18} weight="bold" />
            Return to Dashboard
          </button>
        </div>
        <p className="text-white/70">Manage schedules, requests, teams, and facilities</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="relative w-full backdrop-blur-sm px-2 py-2 shadow-inner bg-[#3e4347] rounded-lg">
          <div className="relative grid w-full grid-cols-7 gap-2 h-full">
            <div 
              className="absolute shadow-xl shadow-black/30 transition-all duration-300 ease-out"
              style={{
                left: `calc(${activeIndex * 14.286}% + 0.5rem)`,
                top: '0.375rem',
                bottom: '0.375rem',
                width: 'calc(14.286% - 1rem)',
                background: 'rgba(36, 139, 204, 0.75)',
                boxShadow: '0 8px 32px rgba(36, 139, 204, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                borderRadius: '0.5rem'
              }}
            />
            
            {tabOptions.map((option) => {
              const Icon = option.icon
              const hasNotification = option.hasNotification
              return (
                <button
                  key={option.value}
                  onClick={() => setActiveTab(option.value)}
                  className={`group relative z-10 flex items-center justify-center gap-2 py-2 transition-all duration-300 ${
                    activeTab === option.value 
                      ? 'drop-shadow-lg' 
                      : 'opacity-70 hover:opacity-90'
                  }`}
                  style={{ color: '#ffffff', borderRadius: '0.5rem' }}
                >
                  <div className="flex items-center gap-2 group-hover:scale-110 transition-transform duration-200">
                    <div className="relative">
                      <Icon size={18} weight="duotone" />
                      {hasNotification && (
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-[#3e4347] shadow-lg" />
                      )}
                    </div>
                    <span className="hidden sm:inline font-medium text-sm">{option.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <TabsList className="hidden">
          {tabOptions.map(option => (
            <TabsTrigger key={option.value} value={option.value} />
          ))}
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