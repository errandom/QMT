import { useState, useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { FacilityRequest, EquipmentRequest, CancellationRequest, User, Event } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Check, X, ClipboardText, Prohibit, WhatsappLogo, MapPin } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { COLORS } from '@/lib/constants'
import EventUpdateShareDialog from '@/components/EventUpdateShareDialog'

interface RequestsManagerProps {
  currentUser: User
}

export default function RequestsManager({ currentUser }: RequestsManagerProps) {
  const { 
    facilityRequests, setFacilityRequests,
    equipmentRequests, setEquipmentRequests,
    cancellationRequests, setCancellationRequests,
    teams, events, setEvents,
    fields, sites
  } = useData()

  // Share dialog state
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareDialogEvent, setShareDialogEvent] = useState<Event | null>(null)
  const [shareDialogOriginalEvent, setShareDialogOriginalEvent] = useState<Event | null>(null)

  // Approval dialog state (for facility requests - to specify location)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalRequest, setApprovalRequest] = useState<FacilityRequest | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string>('')

  // Rejection dialog state (for WhatsApp notification)
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [rejectionRequest, setRejectionRequest] = useState<FacilityRequest | EquipmentRequest | CancellationRequest | null>(null)
  const [rejectionRequestType, setRejectionRequestType] = useState<'facility' | 'equipment' | 'cancellation'>('facility')
  const [sendWhatsAppNotification, setSendWhatsAppNotification] = useState(true)
  const [rejectionMessage, setRejectionMessage] = useState('')

  // Get location options for approval dialog (only sports fields, not meeting rooms)
  const locationOptions = useMemo(() => {
    return fields
      .filter((f: any) => {
        const site = (sites || []).find((s: any) => s.id === f.siteId)
        // Only include active fields from active sports facilities (not meeting rooms)
        const isField = !f.locationType || f.locationType === 'field'
        return f.isActive && site?.isActive && site?.isSportsFacility && isField
      })
      .map((f: any) => ({
        id: String(f.id), // Ensure id is always a string
        name: f.name || 'Unnamed Field',
        siteName: (sites || []).find((s: any) => s.id === f.siteId)?.name || 'Unknown Site'
      }))
  }, [fields, sites])

  // Generate standard rejection message
  const generateRejectionMessage = (request: FacilityRequest | EquipmentRequest | CancellationRequest, type: string) => {
    let message = `Hi ${request.requestorName},\n\n`
    message += `Your ${type} request has been reviewed and unfortunately cannot be approved at this time.\n\n`
    
    if ('eventType' in request) {
      // FacilityRequest
      message += `📋 Request Details:\n`
      message += `• Type: ${request.eventType}\n`
      message += `• Date: ${request.date}\n`
      message += `• Time: ${request.startTime} (${request.duration} min)\n`
      if (request.purpose) message += `• Purpose: ${request.purpose}\n`
    } else if ('equipmentDescription' in request) {
      // EquipmentRequest
      message += `📋 Request Details:\n`
      message += `• Equipment: ${request.equipmentDescription}\n`
      message += `• Date Needed: ${request.date}\n`
    } else if ('eventTitle' in request) {
      // CancellationRequest
      message += `📋 Request Details:\n`
      message += `• Event: ${request.eventTitle}\n`
      message += `• Date: ${request.eventDate}\n`
      message += `• Time: ${request.eventTime}\n`
    }
    
    message += `\nPlease contact us if you have any questions.\n\n`
    message += `Quick - Mean - Tough!\nAFC Zurich Renegades`
    
    return message
  }

  // Open approval dialog for facility request
  const handleOpenApprovalDialog = (request: FacilityRequest) => {
    setApprovalRequest(request)
    setSelectedFieldId('')
    setShowApprovalDialog(true)
  }

  // Open rejection dialog
  const handleOpenRejectionDialog = (
    request: FacilityRequest | EquipmentRequest | CancellationRequest,
    type: 'facility' | 'equipment' | 'cancellation'
  ) => {
    setRejectionRequest(request)
    setRejectionRequestType(type)
    setSendWhatsAppNotification(true)
    setRejectionMessage(generateRejectionMessage(request, type))
    setShowRejectionDialog(true)
  }

  // Confirm approval with location
  const handleConfirmApproval = async () => {
    if (!approvalRequest) return

    try {
      const endTime = calculateEndTime(approvalRequest.startTime, approvalRequest.duration)
      
      // Create event via API with selected field
      const eventData = {
        team_ids: approvalRequest.teamIds && approvalRequest.teamIds.length > 0 ? approvalRequest.teamIds.join(',') : null,
        field_id: selectedFieldId ? parseInt(selectedFieldId) : null,
        event_type: approvalRequest.eventType,
        start_time: `${approvalRequest.date}T${approvalRequest.startTime}:00`,
        end_time: `${approvalRequest.date}T${endTime}:00`,
        description: approvalRequest.opponent 
          ? `${approvalRequest.eventType} vs ${approvalRequest.opponent}` 
          : approvalRequest.purpose 
            ? `${approvalRequest.eventType} - ${approvalRequest.purpose}`
            : approvalRequest.eventType,
        notes: approvalRequest.description || '',
        status: selectedFieldId ? 'Confirmed' : 'Planned',
        other_participants: approvalRequest.opponent || null
      }
      
      const newEvent = await api.createEvent(eventData)
      
      // Update local state
      setEvents((current = []) => [...current, newEvent])
      
      // Update request status
      setFacilityRequests((current = []) =>
        current.map(r =>
          r.id === approvalRequest.id
            ? { ...r, status: 'Approved' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
            : r
        )
      )
      
      toast.success(selectedFieldId 
        ? 'Facility request approved and event created with location' 
        : 'Facility request approved - event created without location')
      
      setShowApprovalDialog(false)
      setApprovalRequest(null)
      setSelectedFieldId('')
    } catch (error: any) {
      console.error('Error approving facility request:', error)
      toast.error(error.message || 'Failed to approve facility request')
    }
  }

  // Confirm rejection with optional WhatsApp notification
  const handleConfirmRejection = () => {
    if (!rejectionRequest) return

    // Update the appropriate request list
    if (rejectionRequestType === 'facility') {
      setFacilityRequests((current = []) =>
        current.map(r =>
          r.id === rejectionRequest.id
            ? { ...r, status: 'Rejected' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
            : r
        )
      )
    } else if (rejectionRequestType === 'equipment') {
      setEquipmentRequests((current = []) =>
        current.map(r =>
          r.id === rejectionRequest.id
            ? { ...r, status: 'Rejected' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
            : r
        )
      )
    } else if (rejectionRequestType === 'cancellation') {
      setCancellationRequests((current = []) =>
        current.map(r =>
          r.id === rejectionRequest.id
            ? { ...r, status: 'Rejected' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
            : r
        )
      )
    }

    // Send WhatsApp notification if enabled
    if (sendWhatsAppNotification && rejectionRequest.requestorPhone) {
      const phone = rejectionRequest.requestorPhone.replace(/[^0-9+]/g, '')
      const encodedMessage = encodeURIComponent(rejectionMessage)
      window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`, '_blank')
    }

    toast.success(`${rejectionRequestType.charAt(0).toUpperCase() + rejectionRequestType.slice(1)} request rejected`)
    
    setShowRejectionDialog(false)
    setRejectionRequest(null)
    setRejectionMessage('')
  }
  
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + durationMinutes
    const endHours = Math.floor(totalMinutes / 60) % 24
    const endMinutes = totalMinutes % 60
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
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

  const handleApproveCancellation = async (requestId: string) => {
    const request = cancellationRequests.find(r => r.id === requestId)
    
    if (!request) {
      toast.error('Request not found')
      return
    }

    try {
      // Find the corresponding event
      const event = events.find(e => e.id === request.eventId)
      
      if (event) {
        // Store original event for share dialog
        const originalEvent = { ...event }
        
        // Update the event status to Cancelled via API
        const updateData = {
          team_ids: event.teamIds && event.teamIds.length > 0 ? event.teamIds.join(',') : null,
          field_id: event.fieldId ? parseInt(event.fieldId) : null,
          event_type: event.eventType,
          start_time: `${event.date}T${event.startTime}:00`,
          end_time: `${event.date}T${event.endTime}:00`,
          description: event.title || '',
          notes: event.notes || '',
          status: 'Cancelled',
          other_participants: event.otherParticipants || null,
          estimated_attendance: event.estimatedAttendance || null
        }
        
        await api.updateEvent(parseInt(event.id), updateData)
        
        // Create cancelled event for share dialog
        const cancelledEvent: Event = { ...event, status: 'Cancelled' }
        
        // Update local state
        setEvents((current = []) =>
          current.map(e =>
            e.id === request.eventId
              ? { ...e, status: 'Cancelled' as const }
              : e
          )
        )
        
        // Show share dialog for cancellation notification
        setShareDialogOriginalEvent(originalEvent)
        setShareDialogEvent(cancelledEvent)
        setShowShareDialog(true)
      }
      
      // Update request status
      setCancellationRequests((current = []) =>
        current.map(r =>
          r.id === requestId
            ? { ...r, status: 'Approved' as const, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.username }
            : r
        )
      )
      
      toast.success('Cancellation request approved and event cancelled')
    } catch (error: any) {
      console.error('Error approving cancellation request:', error)
      toast.error(error.message || 'Failed to approve cancellation request')
    }
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
                          onClick={() => handleOpenRejectionDialog(request, 'cancellation')}
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
                          onClick={() => handleOpenApprovalDialog(request)}
                        >
                          <Check className="mr-1" size={16} weight="bold" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleOpenRejectionDialog(request, 'facility')}
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
                          onClick={() => handleOpenRejectionDialog(request, 'equipment')}
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

      {/* Event Update Share Dialog for Cancellations */}
      {shareDialogEvent && (
        <EventUpdateShareDialog
          isOpen={showShareDialog}
          onClose={() => {
            setShowShareDialog(false)
            setShareDialogEvent(null)
            setShareDialogOriginalEvent(null)
          }}
          event={shareDialogEvent}
          originalEvent={shareDialogOriginalEvent}
          teams={teams}
          fields={fields}
          sites={sites}
          updateType="cancel"
        />
      )}

      {/* Facility Approval Dialog - to specify location */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={20} style={{ color: COLORS.ACCENT }} />
              Approve Facility Request
            </DialogTitle>
            <DialogDescription>
              Specify the location for this event. You can leave it empty and assign later.
            </DialogDescription>
          </DialogHeader>

          {approvalRequest && (
            <div className="space-y-4">
              {/* Request Summary */}
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="font-medium">{approvalRequest.eventType} Request</div>
                <div className="text-muted-foreground">
                  {approvalRequest.date} at {approvalRequest.startTime} ({approvalRequest.duration} min)
                </div>
                {approvalRequest.teamIds && approvalRequest.teamIds.length > 0 && (
                  <div className="text-muted-foreground">
                    Teams: {getTeamNames(approvalRequest.teamIds)}
                  </div>
                )}
                {approvalRequest.purpose && (
                  <div className="text-muted-foreground">Purpose: {approvalRequest.purpose}</div>
                )}
              </div>

              {/* Location Selection */}
              <div className="space-y-2">
                <Label htmlFor="location">Location (Field/Site)</Label>
                <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select a location (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.map((location: any) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.siteName} - {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If no location is selected, the event will be created with status "Planned". 
                  With a location, it will be "Confirmed".
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowApprovalDialog(false)
                setApprovalRequest(null)
                setSelectedFieldId('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmApproval}
              style={{ backgroundColor: COLORS.ACCENT }}
            >
              <Check size={16} className="mr-2" />
              Approve & Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog - with WhatsApp notification option */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X size={20} />
              Reject Request
            </DialogTitle>
            <DialogDescription>
              Reject this request and optionally notify the requestor via WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {rejectionRequest && (
            <div className="space-y-4">
              {/* Request Summary */}
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="font-medium">
                  {rejectionRequestType === 'facility' && 'eventType' in rejectionRequest && `${rejectionRequest.eventType} Request`}
                  {rejectionRequestType === 'equipment' && 'Equipment Request'}
                  {rejectionRequestType === 'cancellation' && 'eventTitle' in rejectionRequest && `Cancellation: ${rejectionRequest.eventTitle}`}
                </div>
                <div className="text-muted-foreground">
                  Requestor: {rejectionRequest.requestorName}
                </div>
                <div className="text-muted-foreground">
                  Phone: {rejectionRequest.requestorPhone}
                </div>
              </div>

              {/* WhatsApp Notification Option */}
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox
                  id="send-whatsapp"
                  checked={sendWhatsAppNotification}
                  onCheckedChange={(checked) => setSendWhatsAppNotification(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="send-whatsapp"
                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                  >
                    <WhatsappLogo size={18} className="text-green-600" weight="fill" />
                    Notify via WhatsApp
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Send a message to {rejectionRequest.requestorPhone}
                  </p>
                </div>
              </div>

              {/* Message Editor (only shown when WhatsApp is enabled) */}
              {sendWhatsAppNotification && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-message">Message</Label>
                  <Textarea
                    id="rejection-message"
                    value={rejectionMessage}
                    onChange={(e) => setRejectionMessage(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    You can edit the message above before sending.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectionDialog(false)
                setRejectionRequest(null)
                setRejectionMessage('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRejection}
            >
              <X size={16} className="mr-2" />
              Reject Request
              {sendWhatsAppNotification && (
                <WhatsappLogo size={16} className="ml-2" weight="fill" />
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
