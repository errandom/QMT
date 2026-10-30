import { ReactNode, useState, useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { FacilityRequest, EquipmentRequest, CancellationRequest, User, Event } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OperationsCardGrid, OperationsCardHeader, OperationsCardSection } from './OperationsCards'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Check, X, ClipboardText, Prohibit, WhatsappLogo, MapPin, CaretDown, CaretRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { COLORS } from '@/lib/constants'
import EventUpdateShareDialog from '@/components/EventUpdateShareDialog'
import FacilityRequestCard from './FacilityRequestCard'
import { facilityLocations, needsFacilityAttention } from '@/lib/facilityWorkflow'

interface RequestsManagerProps {
  currentUser: User
}

function RequestDetails({ request, children }: {
  request: Pick<FacilityRequest, 'requestorName' | 'requestorPhone'>
  children: ReactNode
}) {
  return (
    <OperationsCardSection name="metadata" className="grid gap-4 sm:grid-cols-2">
      <OperationsCardSection name="requestor">
        <span className="text-muted-foreground">Requestor:</span> {request.requestorName}
      </OperationsCardSection>
      <OperationsCardSection name="phone">
        <span className="text-muted-foreground">Phone:</span> {request.requestorPhone}
      </OperationsCardSection>
      {children}
    </OperationsCardSection>
  )
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
  const [shareDialogUpdateType, setShareDialogUpdateType] = useState<'update' | 'cancel' | 'create'>('cancel')

  // Approval dialog state (for facility requests - to specify location)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalRequest, setApprovalRequest] = useState<FacilityRequest | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string>('')
  const [decisionNote, setDecisionNote] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)

  // Rejection dialog state (for WhatsApp notification)
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [rejectionRequest, setRejectionRequest] = useState<FacilityRequest | EquipmentRequest | CancellationRequest | null>(null)
  const [rejectionRequestType, setRejectionRequestType] = useState<'facility' | 'equipment' | 'cancellation'>('facility')
  const [sendWhatsAppNotification, setSendWhatsAppNotification] = useState(true)
  const [rejectionMessage, setRejectionMessage] = useState('')

  const locationOptions = useMemo(() =>
    approvalRequest ? facilityLocations(approvalRequest, fields, sites) : [],
  [approvalRequest, fields, sites])

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
    message += `Club operations`
    
    return message
  }

  // Open approval dialog for facility request
  const handleOpenApprovalDialog = (request: FacilityRequest) => {
    setApprovalRequest(request)
    setSelectedFieldId('')
    setDecisionNote('')
    setShowApprovalDialog(true)
  }

  // Open rejection dialog
  const handleOpenRejectionDialog = (
    request: FacilityRequest | EquipmentRequest | CancellationRequest,
    type: 'facility' | 'equipment' | 'cancellation'
  ) => {
    setRejectionRequest(request)
    setRejectionRequestType(type)
    setSendWhatsAppNotification(type !== 'facility')
    setDecisionNote('')
    setRejectionMessage(generateRejectionMessage(request, type))
    setShowRejectionDialog(true)
  }

  // Confirm approval with location
  const handleConfirmApproval = async () => {
    if (!approvalRequest || isReviewing) return
    setIsReviewing(true)
    try {
      const result = await api.reviewRequest(approvalRequest.id, 'Approved', selectedFieldId || undefined, {
        expectedVersion: approvalRequest.workflow?.version || 0, decisionNote,
      })
      const saved = result.request
      if (saved.type !== 'facility') throw new Error('Unexpected request type returned; reload requests')
      setFacilityRequests(current => current.map(item => item.id === saved.id ? saved : item))
      if (result.event) {
        const created = result.event
        setEvents(current => [...current, created])
        setShareDialogOriginalEvent(null)
        setShareDialogEvent(result.event)
        setShareDialogUpdateType('create')
        setShowShareDialog(true)
      }
      toast.success('Request approved and booking saved. Record the requester notification in the workflow.')
      setShowApprovalDialog(false)
      setApprovalRequest(null)
      setSelectedFieldId('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval was not saved')
    } finally { setIsReviewing(false) }
  }

  // Confirm rejection with optional WhatsApp notification
  const handleConfirmRejection = async () => {
    if (!rejectionRequest || isReviewing) return
    if (rejectionRequestType === 'facility' && !decisionNote.trim()) {
      toast.error('Provide a reason for rejection')
      return
    }
    setIsReviewing(true)
    try {
      const result = await api.reviewRequest(rejectionRequest.id, 'Rejected', undefined,
        rejectionRequestType === 'facility' && 'eventType' in rejectionRequest
          ? { expectedVersion: rejectionRequest.workflow?.version || 0, decisionNote } : undefined)
      const id = rejectionRequest.id
      const metadata = { status: result.request.status, reviewedAt: result.request.reviewedAt, reviewedBy: result.request.reviewedBy }
      const saved = result.request
      if (saved.type === 'facility') setFacilityRequests(current => current.map(item => item.id === id ? saved : item))
      setEquipmentRequests(current => current.map(item => item.id === id ? { ...item, ...metadata } : item))
      setCancellationRequests(current => current.map(item => item.id === id ? { ...item, ...metadata } : item))
      if (rejectionRequestType !== 'facility' && sendWhatsAppNotification && rejectionRequest.requestorPhone) {
        const phone = rejectionRequest.requestorPhone.replace(/[^0-9+]/g, '')
        window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(rejectionMessage)}`, '_blank')
      }
      toast.success(rejectionRequestType === 'facility' ? 'Rejection saved. Record the requester notification in the workflow.' : 'Request rejection saved')
      setShowRejectionDialog(false)
      setRejectionRequest(null)
      setRejectionMessage('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rejection was not saved')
    } finally { setIsReviewing(false) }
  }


  const handleApproveEquipment = async (requestId: string) => {
    try {
      const result = await api.reviewRequest(requestId, 'Approved')
      setEquipmentRequests(current => current.map(item => item.id === requestId ? { ...item, status: result.request.status, reviewedAt: result.request.reviewedAt, reviewedBy: result.request.reviewedBy } : item))
      toast.success('Equipment request approval saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval was not saved')
    }
  }

  const handleApproveCancellation = async (requestId: string) => {
    try {
      const result = await api.reviewRequest(requestId, 'Approved')
      setCancellationRequests(current => current.map(item => item.id === requestId ? { ...item, status: result.request.status, reviewedAt: result.request.reviewedAt, reviewedBy: result.request.reviewedBy } : item))
      if (result.event) {
        const cancelled = result.event
        setShareDialogOriginalEvent(events.find(item => item.id === cancelled.id) || null)
        setShareDialogEvent(cancelled)
        setShareDialogUpdateType('cancel')
        setShowShareDialog(true)
        setEvents(current => current.map(item => item.id === cancelled.id ? cancelled : item))
      }
      toast.success('Cancellation approved and event updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cancellation was not saved')
    }
  }

  const getTeamNames = (teamIds?: string[]) => {
    if (!teamIds || teamIds.length === 0) return 'N/A'
    return teamIds.map((id: string) => (teams as any[]).find((t: any) => t.id === id)?.name || 'Unknown').join(', ')
  }

  const pendingFacilityCount = facilityRequests.filter(needsFacilityAttention).length
  const pendingEquipmentCount = equipmentRequests.filter(r => r.status === 'Pending').length
  const pendingCancellationCount = cancellationRequests.filter(r => r.status === 'Pending').length

  // Collapsible state for resolved (approved/rejected) requests - collapsed by default
  const [showResolvedCancellations, setShowResolvedCancellations] = useState(false)
  const [showResolvedFacility, setShowResolvedFacility] = useState(false)
  const [showResolvedEquipment, setShowResolvedEquipment] = useState(false)

  // Split requests into pending and resolved
  const pendingCancellations = cancellationRequests.filter(r => r.status === 'Pending')
  const resolvedCancellations = cancellationRequests.filter(r => r.status !== 'Pending')
  const pendingFacility = facilityRequests.filter(needsFacilityAttention)
  const resolvedFacility = facilityRequests.filter(r => !needsFacilityAttention(r))
  const pendingEquipment = equipmentRequests.filter(r => r.status === 'Pending')
  const resolvedEquipment = equipmentRequests.filter(r => r.status !== 'Pending')

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Requests Management</h2>
        <div className="flex flex-wrap gap-2">
          {pendingCancellationCount > 0 && (
            <Badge variant="destructive">{pendingCancellationCount} pending cancellations</Badge>
          )}
          {pendingFacilityCount > 0 && (
            <Badge variant="destructive">{pendingFacilityCount} facility follow-ups</Badge>
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
          <div className="space-y-4">
            {/* Pending Cancellation Requests */}
            {pendingCancellations.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                No pending cancellation requests.
              </div>
            ) : (
              <OperationsCardGrid columns={1}>
                {pendingCancellations.map((request) => (
                  <Card key={request.id}>
                    <OperationsCardHeader
                      title={<>Cancellation Request - {request.eventTitle}</>}
                      icon={<Prohibit size={18} weight="duotone" className="mt-0.5" />}
                      badges={
                        <Badge variant="default">
                          {request.status}
                        </Badge>
                      }
                      actions={
                        <>
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
                        </>
                      }
                    />
                    <CardContent className="flex flex-1 flex-col gap-2 text-sm">
                      <RequestDetails request={request}>
                        <div>
                          <span className="text-muted-foreground">Event Date:</span> {request.eventDate}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Event Time:</span> {request.eventTime}
                        </div>
                      </RequestDetails>
                      <OperationsCardSection name="justification">
                        <span className="text-muted-foreground">Justification:</span> {request.justification}
                      </OperationsCardSection>
                    </CardContent>
                  </Card>
                ))}
              </OperationsCardGrid>
            )}

            {/* Resolved Cancellation Requests - Collapsible */}
            {resolvedCancellations.length > 0 && (
              <Collapsible open={showResolvedCancellations} onOpenChange={setShowResolvedCancellations}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
                    {showResolvedCancellations ? <CaretDown size={16} /> : <CaretRight size={16} />}
                    <span>Resolved Requests ({resolvedCancellations.length})</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <OperationsCardGrid columns={1}>
                    {resolvedCancellations.map((request) => (
                      <Card key={request.id} className="opacity-70">
                        <OperationsCardHeader
                          title={<>Cancellation Request - {request.eventTitle}</>}
                          icon={<Prohibit size={18} weight="duotone" className="mt-0.5" />}
                          badges={
                            <Badge variant={request.status === 'Approved' ? 'secondary' : 'destructive'}>
                              {request.status}
                            </Badge>
                          }
                        />
                        <CardContent className="flex flex-1 flex-col gap-2 text-sm">
                          <RequestDetails request={request}>
                            <div>
                              <span className="text-muted-foreground">Event Date:</span> {request.eventDate}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Event Time:</span> {request.eventTime}
                            </div>
                          </RequestDetails>
                          <OperationsCardSection name="justification">
                            <span className="text-muted-foreground">Justification:</span> {request.justification}
                          </OperationsCardSection>
                          {request.reviewedAt && (
                            <div className="mt-auto space-y-2">
                              <Separator />
                              <div className="text-xs text-muted-foreground">
                                Reviewed by {request.reviewedBy} on {new Date(request.reviewedAt).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </OperationsCardGrid>
                </CollapsibleContent>
              </Collapsible>
            )}
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
          <div className="space-y-4">
            {/* Pending Facility Requests */}
            {pendingFacility.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                No facility requests need follow-up.
              </div>
            ) : (
              <OperationsCardGrid columns={1}>
                {pendingFacility.map(request => <FacilityRequestCard key={request.id} request={request}
                  onApprove={handleOpenApprovalDialog} onReject={request => handleOpenRejectionDialog(request, 'facility')} />)}
              </OperationsCardGrid>
            )}

            {/* Resolved Facility Requests - Collapsible */}
            {resolvedFacility.length > 0 && (
              <Collapsible open={showResolvedFacility} onOpenChange={setShowResolvedFacility}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
                    {showResolvedFacility ? <CaretDown size={16} /> : <CaretRight size={16} />}
                    <span>Resolved Requests ({resolvedFacility.length})</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <OperationsCardGrid columns={1}>
                    {resolvedFacility.map(request => <FacilityRequestCard key={request.id} request={request}
                      onApprove={handleOpenApprovalDialog} onReject={request => handleOpenRejectionDialog(request, 'facility')} />)}
                  </OperationsCardGrid>
                </CollapsibleContent>
              </Collapsible>
            )}
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
          <div className="space-y-4">
            {/* Pending Equipment Requests */}
            {pendingEquipment.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                No pending equipment requests.
              </div>
            ) : (
              <OperationsCardGrid columns={1}>
                {pendingEquipment.map((request) => (
                  <Card key={request.id}>
                    <OperationsCardHeader
                      title="Equipment Request"
                      icon={<ClipboardText size={18} weight="duotone" className="mt-0.5" />}
                      badges={
                        <Badge variant="default">
                          {request.status}
                        </Badge>
                      }
                      actions={
                        <>
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
                        </>
                      }
                    />
                    <CardContent className="flex flex-1 flex-col gap-2 text-sm">
                      <RequestDetails request={request}>
                        <div>
                          <span className="text-muted-foreground">Date Needed:</span> {request.date}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Teams:</span> {getTeamNames(request.teamIds)}
                        </div>
                      </RequestDetails>
                      <OperationsCardSection name="equipment">
                        <span className="text-muted-foreground">Equipment:</span> {request.equipmentDescription}
                      </OperationsCardSection>
                    </CardContent>
                  </Card>
                ))}
              </OperationsCardGrid>
            )}

            {/* Resolved Equipment Requests - Collapsible */}
            {resolvedEquipment.length > 0 && (
              <Collapsible open={showResolvedEquipment} onOpenChange={setShowResolvedEquipment}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
                    {showResolvedEquipment ? <CaretDown size={16} /> : <CaretRight size={16} />}
                    <span>Resolved Requests ({resolvedEquipment.length})</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <OperationsCardGrid columns={1}>
                    {resolvedEquipment.map((request) => (
                      <Card key={request.id} className="opacity-70">
                        <OperationsCardHeader
                          title="Equipment Request"
                          icon={<ClipboardText size={18} weight="duotone" className="mt-0.5" />}
                          badges={
                            <Badge variant={request.status === 'Approved' ? 'secondary' : 'destructive'}>
                              {request.status}
                            </Badge>
                          }
                        />
                        <CardContent className="flex flex-1 flex-col gap-2 text-sm">
                          <RequestDetails request={request}>
                            <div>
                              <span className="text-muted-foreground">Date Needed:</span> {request.date}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Teams:</span> {getTeamNames(request.teamIds)}
                            </div>
                          </RequestDetails>
                          <OperationsCardSection name="equipment">
                            <span className="text-muted-foreground">Equipment:</span> {request.equipmentDescription}
                          </OperationsCardSection>
                          {request.reviewedAt && (
                            <div className="mt-auto space-y-2">
                              <Separator />
                              <div className="text-xs text-muted-foreground">
                                Reviewed by {request.reviewedBy} on {new Date(request.reviewedAt).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </OperationsCardGrid>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </div>

      {/* Event Update Share Dialog for Cancellations and Approvals */}
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
          updateType={shareDialogUpdateType}
        />
      )}

      {/* Facility Approval Dialog - to specify location */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="operations-dialog max-h-[85dvh] overflow-y-auto text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={20} style={{ color: COLORS.ACCENT }} />
              Approve Facility Request
            </DialogTitle>
            <DialogDescription>
              Review the allocation and conditions before creating one booking. Notification of the requester is a separate workflow step.
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

              <p className="text-sm">This creates one booking on {approvalRequest.date}, not a multi-day series. Schedule any remaining dates separately before communicating full approval.</p>

              {/* Location Selection */}
              <div className="space-y-2">
                <Label htmlFor="location">Location ({approvalRequest.locationType === 'meeting_room' ? 'Meeting room' : 'Field'})</Label>
                <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select a location (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If no location is selected, the event will be created with status "Planned". 
                  With a location, it will be "Confirmed".
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="approval-note">Decision / conditions to share with requester (optional)</Label>
                <Textarea id="approval-note" value={decisionNote} maxLength={4000}
                  onChange={event => setDecisionNote(event.target.value)} />
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
              disabled={isReviewing}
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
        <DialogContent className="operations-dialog max-h-[85dvh] overflow-y-auto text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X size={20} />
              Reject Request
            </DialogTitle>
            <DialogDescription>
              {rejectionRequestType === 'facility'
                ? 'Record the reason for rejection. Notify the requester and record that communication in the workflow afterward.'
                : 'Reject this request and optionally prepare a WhatsApp draft for the requester.'}
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

              {rejectionRequestType === 'facility' && <div className="space-y-2">
                <Label htmlFor="rejection-note">Reason / outcome to share with requester *</Label>
                <Textarea id="rejection-note" value={decisionNote} required maxLength={4000}
                  onChange={event => setDecisionNote(event.target.value)} />
              </div>}
              {/* WhatsApp Notification Option */}
              {rejectionRequestType !== 'facility' && <div className="flex items-start gap-3 p-3 border rounded-lg">
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
              </div>}

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
              disabled={isReviewing}
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
