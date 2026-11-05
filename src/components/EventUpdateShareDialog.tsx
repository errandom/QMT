import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { WhatsappLogo, Envelope, X, ArrowRight, CloudArrowUp, CheckCircle, Warning, ArrowsClockwise } from '@phosphor-icons/react'
import { Event, Team, Field, Site, User } from '@/lib/types'
import { shareMessage } from '@/lib/whatsappService'
import { toast } from 'sonner'
import { apiRequest, getToken } from '@/lib/api'
import { useCapabilities } from '@/hooks/useCapabilities'
import { formatEventTimeRange } from '@/lib/utils'
import { eventMessageDraft, type EventMessageAction } from '@/lib/eventMessages'
import { useMessageDraft } from '@/hooks/useMessageDraft'
import MessageLanguageSwitch from './OperationsOffice/MessageLanguageSwitch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SharedFieldNotice from './SharedFieldNotice'

interface EventChange {
  field: string
  label: string
  before: string | null
  after: string | null
}

interface EventUpdateShareDialogProps {
  isOpen: boolean
  onClose: () => void
  event: Event
  originalEvent: Event | null // null for new events
  teams: Team[]
  fields: Field[]
  sites: Site[]
  updateType: EventMessageAction
  currentUser: User
}

export default function EventUpdateShareDialog({
  isOpen,
  onClose,
  event,
  originalEvent,
  teams,
  fields,
  sites,
  updateType,
  currentUser,
}: EventUpdateShareDialogProps) {
  const [sharing, setSharing] = useState(false)
  const { capabilities } = useCapabilities()
  const [pushingToSpond, setPushingToSpond] = useState(false)
  const [spondPushResult, setSpondPushResult] = useState<'success' | 'error' | 'already' | null>(null)
  const { language, setLanguage, draft, setDraft } = useMessageDraft(language =>
    eventMessageDraft(event, originalEvent, updateType, teams, fields, sites, currentUser, language))

  // Get related teams
  const eventTeams = event.teamIds 
    ? teams.filter(t => event.teamIds?.includes(t.id))
    : []

  // Get field and site info - support multiple fields
  const eventFieldIds = event.fieldIds || []
  const eventFields = eventFieldIds.map(id => fields.find(f => f.id === id)).filter(Boolean)
  const primaryField = eventFields[0]
  const site = primaryField ? sites.find(s => s.id === primaryField.siteId) : null
  const fieldNames = eventFields.map(f => f?.name).join(', ')
  const locationName = site && fieldNames ? `${site.name} - ${fieldNames}` : fieldNames || site?.name || 'TBD'

  // Calculate changes
  const changes: EventChange[] = []
  
  if (originalEvent && updateType !== 'create') {
    // Date change
    if (originalEvent.date !== event.date) {
      changes.push({
        field: 'date',
        label: 'Date',
        before: formatDate(originalEvent.date),
        after: formatDate(event.date)
      })
    }
    
    // Time change
    if (formatEventTimeRange(originalEvent) !== formatEventTimeRange(event)) {
      changes.push({
        field: 'time',
        label: 'Time',
        before: formatEventTimeRange(originalEvent),
        after: formatEventTimeRange(event)
      })
    }
    
    // Location change - support multiple fields
    const origFieldIds = originalEvent.fieldIds || []
    const origFields = origFieldIds.map(id => fields.find(f => f.id === id)).filter(Boolean)
    const origPrimaryField = origFields[0]
    const origSite = origPrimaryField ? sites.find(s => s.id === origPrimaryField.siteId) : null
    const origFieldNames = origFields.map(f => f?.name).join(', ')
    const origLocation = origSite && origFieldNames ? `${origSite.name} - ${origFieldNames}` : origFieldNames || origSite?.name || 'TBD'
    
    if (origLocation !== locationName) {
      changes.push({
        field: 'location',
        label: 'Location',
        before: origLocation,
        after: locationName
      })
    }
    
    // Status change (including cancellation)
    if (originalEvent.status !== event.status) {
      changes.push({
        field: 'status',
        label: 'Status',
        before: originalEvent.status,
        after: event.status
      })
    }
    
    // Event type change
    if (originalEvent.eventType !== event.eventType) {
      changes.push({
        field: 'eventType',
        label: 'Event Type',
        before: originalEvent.eventType,
        after: event.eventType
      })
    }
    
    // Teams change
    const origTeamNames = originalEvent.teamIds 
      ? teams.filter(t => originalEvent.teamIds?.includes(t.id)).map(t => t.name).join(', ')
      : 'None'
    const newTeamNames = eventTeams.map(t => t.name).join(', ') || 'None'
    
    if (origTeamNames !== newTeamNames) {
      changes.push({
        field: 'teams',
        label: 'Teams',
        before: origTeamNames,
        after: newTeamNames
      })
    }
  }

  // Collect recipients for email
  const getEmailRecipients = (): { to: string[]; cc: string[] } => {
    // TO recipients: site manager, team coach, team manager
    const toRecipients: string[] = []
    
    // Add site contact email to TO
    if (site?.contactEmail) {
      toRecipients.push(site.contactEmail)
    }
    
    // Add team coaches and managers to TO
    eventTeams.forEach(team => {
      if (team.headCoach?.email) {
        toRecipients.push(team.headCoach.email)
      }
      if (team.teamManager?.email) {
        toRecipients.push(team.teamManager.email)
      }
    })
    
    return {
      to: [...new Set(toRecipients)],
      cc: []
    }
  }

  // Check if event can be pushed to Spond
  // A team must be assigned and the team should be linked to a Spond group (we check backend-side)
  const hasTeams = eventTeams.length > 0
  const isAlreadyInSpond = Boolean(event.spondId)
  const notification = ['create', 'update', 'cancel'].includes(updateType)
  const canPushToSpond = capabilities?.spond && notification && hasTeams && updateType !== 'cancel'
  const canUpdateInSpond = capabilities?.spond && notification && isAlreadyInSpond && updateType !== 'create'

  const handlePushToSpond = async () => {
    setPushingToSpond(true)
    setSpondPushResult(null)
    
    try {
      const eventId = parseInt(event.id)
      if (isNaN(eventId)) {
        toast.error('Invalid event ID')
        return
      }

      if (isAlreadyInSpond) {
        // Update existing Spond event
        const response = await fetch(`/api/spond/push/event/${eventId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
        })
        const result = await response.json()
        
        if (result.success) {
          setSpondPushResult('success')
          toast.success('Event updated in Spond')
        } else {
          setSpondPushResult('error')
          toast.error(result.error || 'Failed to update in Spond')
        }
      } else {
        // Push new event to Spond (with dedup check)
        const response = await fetch(`/api/spond/push/event/${eventId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
        })
        const result = await response.json()
        
        if (result.success) {
          setSpondPushResult('success')
          toast.success('Event pushed to Spond')
        } else if (result.error?.includes('already linked')) {
          setSpondPushResult('already')
          toast.info('Event is already in Spond')
        } else {
          setSpondPushResult('error')
          toast.error(result.error || 'Failed to push to Spond')
        }
      }
    } catch (error) {
      console.error('Error pushing to Spond:', error)
      setSpondPushResult('error')
      toast.error('Failed to connect to Spond')
    } finally {
      setPushingToSpond(false)
    }
  }

  const handleWhatsAppShare = async () => {
    setSharing(true)
    try {
      const success = await shareMessage(draft.message, draft.subject)
      if (success) {
        toast.success('Draft shared or copied; sending is still manual.')
      }
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error)
      toast.error('Failed to share via WhatsApp')
    } finally {
      setSharing(false)
    }
  }

  const handleEmailShare = async () => {
    setSharing(true)
    try {
      let recipients = getEmailRecipients()
      if (updateType === 'transport') {
        const result = await apiRequest<{ email: { to: string; cc: string[] } }>(`/events/${event.id}/transport-request`, { method: 'POST' })
        recipients = { to: [result.email.to], cc: result.email.cc }
      }
      const ccParam = recipients.cc.length ? `&cc=${encodeURIComponent(recipients.cc.join(','))}` : ''
      window.location.href = `mailto:${recipients.to.join(',')}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.message)}${ccParam}`
      toast.success('Email draft opened; sending is still manual.')
    } catch (error) {
      console.error('Error opening event email draft:', error)
      toast.error('The event is already saved, but its email draft could not be opened. Do not create the event again.')
    } finally {
      setSharing(false)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="operations-dialog max-h-[85dvh] overflow-y-auto text-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {updateType === 'cancel' ? (
              <Badge variant="destructive">Event Cancelled</Badge>
            ) : updateType === 'create' ? (
              <Badge className="bg-green-600">Event Created</Badge>
            ) : updateType === 'update' ? (
              <Badge variant="default">Event Updated</Badge>
            ) : (
              <Badge variant="default">{updateType === 'transport' ? 'Transport Request' : 'Share Event'}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {updateType === 'transport' ? 'Review the transport draft before opening your email client. No message is sent automatically.' :
              updateType === 'share' ? 'Review the message before sharing. No message is sent automatically.' : updateType === 'create'
              ? 'Would you like to notify stakeholders or push this event to Spond?'
              : `Would you like to notify team managers and coaches about this ${updateType === 'cancel' ? 'cancellation' : 'update'}?`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Event Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-sm">{event.title || `${event.eventType}`}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(event.date)} • {formatEventTimeRange(event)}
            </p>
            <p className="text-xs text-muted-foreground">{locationName}</p>
            <SharedFieldNotice event={event} fields={fields} sites={sites} teams={teams} />
            <p className="text-xs text-muted-foreground">
              {eventTeams.map(t => t.name).join(', ') || 'No teams assigned'}
            </p>
          </div>
          
          {/* Changes Summary */}
          {changes.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Changes Made:</p>
                {changes.map((change, idx) => (
                  <div key={idx} className="text-xs bg-muted/30 rounded p-2">
                    <span className="font-medium">{change.label}:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-muted-foreground line-through">{change.before}</span>
                      <ArrowRight size={12} className="text-muted-foreground" />
                      <span className="font-medium text-foreground">{change.after}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* Recipients Info */}
          <Separator />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {updateType === 'transport' ? 'The configured transport contact and recorded team contacts are selected when you open the email draft.' :
                "Opens an email draft addressed only to the site's and teams' recorded contacts."}
            </p>
          </div>
          <fieldset disabled={sharing} className="space-y-3">
            <MessageLanguageSwitch language={language} onChange={setLanguage} />
            <label className="block space-y-1">Subject
              <Input lang={language} value={draft.subject} onChange={event => setDraft({ ...draft, subject: event.target.value })} />
            </label>
            <label className="block space-y-1">Message draft
              <Textarea lang={language} rows={10} value={draft.message} onChange={event => setDraft({ ...draft, message: event.target.value })} />
            </label>
          </fieldset>
        </div>
        
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex gap-2 w-full">
            <Button
              variant="default"
              className="flex-1"
              onClick={handleEmailShare}
              disabled={sharing || !draft.subject.trim() || !draft.message.trim()}
            >
              <Envelope className="mr-2" size={18} weight="duotone" />
              Open email draft
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleWhatsAppShare}
              disabled={sharing || !draft.message.trim()}
            >
              <WhatsappLogo className="mr-2" size={18} weight="duotone" />
              Share / WhatsApp
            </Button>
          </div>
          {/* Spond push/update button */}
          {(canPushToSpond || canUpdateInSpond) && (
            <Button
              variant="outline"
              className={`w-full ${spondPushResult === 'success' ? 'border-green-300 text-green-700 bg-green-50' : spondPushResult === 'error' ? 'border-red-300 text-red-700' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}
              onClick={handlePushToSpond}
              disabled={pushingToSpond || spondPushResult === 'success'}
            >
              {pushingToSpond ? (
                <>
                  <ArrowsClockwise className="mr-2 animate-spin" size={18} />
                  {isAlreadyInSpond ? 'Updating in Spond...' : 'Pushing to Spond...'}
                </>
              ) : spondPushResult === 'success' ? (
                <>
                  <CheckCircle className="mr-2" size={18} weight="fill" />
                  {isAlreadyInSpond ? 'Updated in Spond' : 'Pushed to Spond'}
                </>
              ) : spondPushResult === 'already' ? (
                <>
                  <CheckCircle className="mr-2" size={18} weight="fill" />
                  Already in Spond
                </>
              ) : spondPushResult === 'error' ? (
                <>
                  <Warning className="mr-2" size={18} />
                  Retry Spond Push
                </>
              ) : (
                <>
                  <CloudArrowUp className="mr-2" size={18} weight="duotone" />
                  {isAlreadyInSpond ? 'Update in Spond' : 'Push to Spond'}
                </>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleSkip}
          >
            <X className="mr-2" size={16} />
            Skip Notification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Helper function to format date
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return dateString
  }
}
