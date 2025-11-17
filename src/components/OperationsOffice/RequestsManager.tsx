import { useKV } from '@github/spark/hooks'
import { FacilityRequest, EquipmentRequest, CancellationRequest, User, Event } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, X, ClipboardText, Prohibit } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface RequestsManagerProps {
  currentUser: User
}

export default function RequestsManager({ currentUser }: RequestsManagerProps) {
  const [facilityRequests = [], setFacilityRequests] = useKV<FacilityRequest[]>('facility-requests', [])
  const [equipmentRequests = [], setEquipmentRequests] = useKV<EquipmentRequest[]>('equipment-requests', [])
  const [cancellationRequests = [], setCancellationRequests] = useKV<CancellationRequest[]>('cancellation-requests', [])
  const [teams = []] = useKV<any[]>('teams', [])
  const [events = [], setEvents] = useKV<Event[]>('events', [])

  const handleApproveFacility = (requestId: string) => {
    const request = facilityRequests.find(r => r.id === requestId)
    
    if (request) {
      const endTime = calculateEndTime(request.startTime, request.duration)
      
      const newEvent: Event = {
        id: `event-${Date.now()}`,
        title: request.opponent 
          ? `${request.eventType} vs ${request.opponent}` 
          : request.purpose 
            ? `${request.eventType} - ${request.purpose}`
            : request.eventType,
        eventType: request.eventType,
        status: 'Planned',
        date: request.date,
        startTime: request.startTime,
        endTime: endTime,
        teamIds: request.teamIds || [],
        otherParticipants: request.opponent || undefined,
        notes: request.description || undefined,
        isRecurring: false
      }
      
      setEvents((current = []) => [...current, newEvent])
    }
    
    setFacilityRequests((current = []) =>
      current.map(r =>
        r.id === requestId
          ? { ...r, status: 'Approved' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
          : r
      )
    )
    toast.success('Facility request approved and event created')
  }
  
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + durationMinutes
    const endHours = Math.floor(totalMinutes / 60) % 24
    const endMinutes = totalMinutes % 60
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
  }

  const handleRejectFacility = (requestId: string) => {
    setFacilityRequests((current = []) =>
      current.map(r =>
        r.id === requestId
          ? { ...r, status: 'Rejected' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
          : r
      )
    )
    toast.success('Facility request rejected')
  }

  const handleApproveEquipment = (requestId: string) => {
    setEquipmentRequests((current = []) =>
      current.map(r =>
        r.id === requestId
          ? { ...r, status: 'Approved' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
          : r
      )
    )
    toast.success('Equipment request approved')
  }

  const handleRejectEquipment = (requestId: string) => {
    setEquipmentRequests((current = []) =>
      current.map(r =>
        r.id === requestId
          ? { ...r, status: 'Rejected' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
          : r
      )
    )
    toast.success('Equipment request rejected')
  }

  const handleApproveCancellation = (requestId: string) => {
    setCancellationRequests((current = []) =>
      current.map(r =>
        r.id === requestId
          ? { ...r, status: 'Approved' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
          : r
      )
    )
    toast.success('Cancellation request approved')
  }

  const handleRejectCancellation = (requestId: string) => {
    setCancellationRequests((current = []) =>
      current.map(r =>
        r.id === requestId
          ? { ...r, status: 'Rejected' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
          : r
      )
    )
    toast.success('Cancellation request rejected')
  }

  const getTeamNames = (teamIds?: string[]) => {
    if (!teamIds || teamIds.length === 0) return 'N/A'
    return teamIds.map((id: string) => (teams as any[]).find((t: any) => t.id === id)?.name || 'Unknown').join(', ')
  }

  const pendingFacilityCount = facilityRequests.filter(r => r.status === 'Pending').length
  const pendingEquipmentCount = equipmentRequests.filter(r => r.status === 'Pending').length
  const pendingCancellationCount = cancellationRequests.filter(r => r.status === 'Pending').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Requests Management</h2>
        <div className="flex gap-2">
          {pendingCancellationCount > 0 && (
            <Badge variant="destructive">{pendingCancellationCount} pending cancellations</Badge>
          )}
          {pendingFacilityCount > 0 && (
            <Badge variant="destructive">{pendingFacilityCount} pending facility</Badge>
          )}
          {pendingEquipmentCount > 0 && (
            <Badge variant="destructive">{pendingEquipmentCount} pending equipment</Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Cancellation Requests</h3>
        {cancellationRequests.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 border rounded-lg">
            No cancellation requests yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {cancellationRequests.map((request) => (
              <Card key={request.id} className={request.status !== 'Pending' ? 'opacity-70' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Prohibit size={18} weight="duotone" />
                        Cancellation Request - {request.eventTitle}
                      </CardTitle>
                      <Badge variant={
                        request.status === 'Pending' ? 'default' :
                        request.status === 'Approved' ? 'secondary' : 'destructive'
                      }>
                        {request.status}
                      </Badge>
                    </div>
                    {request.status === 'Pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApproveCancellation(request.id)}
                        >
                          <Check className="mr-1" size={16} weight="bold" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectCancellation(request.id)}
                        >
                          <X className="mr-1" size={16} weight="bold" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground">Requestor:</span> {request.requestorName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span> {request.requestorPhone}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Event Date:</span> {request.eventDate}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Event Time:</span> {request.eventTime}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Justification:</span> {request.justification}
                  </div>
                  {request.reviewedAt && (
                    <>
                      <Separator />
                      <div className="text-xs text-muted-foreground">
                        Reviewed by {request.reviewedBy} on {new Date(request.reviewedAt).toLocaleString()}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Facility Requests</h3>
        {facilityRequests.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 border rounded-lg">
            No facility requests yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {facilityRequests.map((request) => (
              <Card key={request.id} className={request.status !== 'Pending' ? 'opacity-70' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardText size={18} weight="duotone" />
                        {request.eventType} Request
                      </CardTitle>
                      <Badge variant={
                        request.status === 'Pending' ? 'default' :
                        request.status === 'Approved' ? 'secondary' : 'destructive'
                      }>
                        {request.status}
                      </Badge>
                    </div>
                    {request.status === 'Pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApproveFacility(request.id)}
                        >
                          <Check className="mr-1" size={16} weight="bold" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectFacility(request.id)}
                        >
                          <X className="mr-1" size={16} weight="bold" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground">Requestor:</span> {request.requestorName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span> {request.requestorPhone}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span> {request.date}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time:</span> {request.startTime} ({request.duration} min)
                    </div>
                  </div>
                  {request.teamIds && request.teamIds.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Teams:</span> {getTeamNames(request.teamIds)}
                    </div>
                  )}
                  {request.purpose && (
                    <div>
                      <span className="text-muted-foreground">Purpose:</span> {request.purpose}
                    </div>
                  )}
                  {request.description && (
                    <div>
                      <span className="text-muted-foreground">Details:</span> {request.description}
                    </div>
                  )}
                  {request.reviewedAt && (
                    <>
                      <Separator />
                      <div className="text-xs text-muted-foreground">
                        Reviewed by {request.reviewedBy} on {new Date(request.reviewedAt).toLocaleString()}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Equipment Requests</h3>
        {equipmentRequests.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 border rounded-lg">
            No equipment requests yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {equipmentRequests.map((request) => (
              <Card key={request.id} className={request.status !== 'Pending' ? 'opacity-70' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardText size={18} weight="duotone" />
                        Equipment Request
                      </CardTitle>
                      <Badge variant={
                        request.status === 'Pending' ? 'default' :
                        request.status === 'Approved' ? 'secondary' : 'destructive'
                      }>
                        {request.status}
                      </Badge>
                    </div>
                    {request.status === 'Pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApproveEquipment(request.id)}
                        >
                          <Check className="mr-1" size={16} weight="bold" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectEquipment(request.id)}
                        >
                          <X className="mr-1" size={16} weight="bold" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground">Requestor:</span> {request.requestorName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span> {request.requestorPhone}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date Needed:</span> {request.date}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Teams:</span> {getTeamNames(request.teamIds)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equipment:</span> {request.equipmentDescription}
                  </div>
                  {request.reviewedAt && (
                    <>
                      <Separator />
                      <div className="text-xs text-muted-foreground">
                        Reviewed by {request.reviewedBy} on {new Date(request.reviewedAt).toLocaleString()}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}