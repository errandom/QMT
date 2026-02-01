import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { WhatsappLogo, Envelope, X, ArrowRight } from '@phosphor-icons/react'
import { Event, Team, Field, Site } from '@/lib/types'
import { shareEvent } from '@/lib/whatsappService'
import { toast } from 'sonner'

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
  updateType: 'update' | 'cancel' | 'create'
}

export default function EventUpdateShareDialog({
  isOpen,
  onClose,
  event,
  originalEvent,
  teams,
  fields,
  sites,
  updateType
}: EventUpdateShareDialogProps) {
  const [sharing, setSharing] = useState(false)

  // Get related teams
  const eventTeams = event.teamIds 
    ? teams.filter(t => event.teamIds?.includes(t.id))
    : []

  // Get field and site info
  const field = fields.find(f => f.id === event.fieldId)
  const site = field ? sites.find(s => s.id === field.siteId) : null
  const locationName = field && site ? `${site.name} - ${field.name}` : field?.name || site?.name || 'TBD'

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
    if (originalEvent.startTime !== event.startTime || originalEvent.endTime !== event.endTime) {
      changes.push({
        field: 'time',
        label: 'Time',
        before: `${originalEvent.startTime} - ${originalEvent.endTime}`,
        after: `${event.startTime} - ${event.endTime}`
      })
    }
    
    // Location change
    const origField = fields.find(f => f.id === originalEvent.fieldId)
    const origSite = origField ? sites.find(s => s.id === origField.siteId) : null
    const origLocation = origField && origSite ? `${origSite.name} - ${origField.name}` : origField?.name || origSite?.name || 'TBD'
    
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
  const getEmailRecipients = () => {
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
    
    // CC recipients: only bewilligungen and sports
    const ccRecipients = ['bewilligungen@igacr.ch', 'sports@renegades.ch']
    
    return {
      to: [...new Set(toRecipients)],
      cc: ccRecipients
    }
  }

  const handleWhatsAppShare = async () => {
    setSharing(true)
    try {
      // Use existing share function but we could enhance it
      const success = await shareEvent(event, teams, fields, sites)
      if (success) {
        toast.success('Event shared via WhatsApp!')
      }
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error)
      toast.error('Failed to share via WhatsApp')
    } finally {
      setSharing(false)
    }
  }

  const handleEmailShare = () => {
    const recipients = getEmailRecipients()
    
    const formattedDate = formatDate(event.date)
    const teamNames = eventTeams.map(t => t.name).join(', ') || 'N/A'
    
    // Build subject
    const subjectPrefix = updateType === 'cancel' ? 'CANCELLED' : 'UPDATE'
    const eventTitle = event.title || `${event.eventType} - ${teamNames}`
    const subject = encodeURIComponent(`${subjectPrefix}: ${eventTitle}`)
    
    // Build body with before/after summary
    let body = ''
    
    if (updateType === 'cancel') {
      body = `The following event has been CANCELLED:\n\n` +
        `📅 Event: ${eventTitle}\n` +
        `📆 Date: ${formattedDate}\n` +
        `⏰ Time: ${event.startTime} - ${event.endTime}\n` +
        `📍 Location: ${locationName}\n` +
        `👥 Team(s): ${teamNames}\n\n` +
        `We apologize for any inconvenience.\n\n`
    } else if (changes.length > 0) {
      body = `The following event has been UPDATED:\n\n` +
        `📅 Event: ${eventTitle}\n\n` +
        `CHANGES:\n` +
        `${'─'.repeat(30)}\n`
      
      changes.forEach(change => {
        body += `${change.label}:\n`
        body += `  Before: ${change.before}\n`
        body += `  After:  ${change.after}\n\n`
      })
      
      body += `${'─'.repeat(30)}\n\n` +
        `CURRENT DETAILS:\n` +
        `📆 Date: ${formattedDate}\n` +
        `⏰ Time: ${event.startTime} - ${event.endTime}\n` +
        `📍 Location: ${locationName}\n` +
        `👥 Team(s): ${teamNames}\n` +
        `📋 Status: ${event.status}\n\n`
    } else {
      body = `Event details for your reference:\n\n` +
        `📅 Event: ${eventTitle}\n` +
        `📆 Date: ${formattedDate}\n` +
        `⏰ Time: ${event.startTime} - ${event.endTime}\n` +
        `📍 Location: ${locationName}\n` +
        `👥 Team(s): ${teamNames}\n` +
        `📋 Status: ${event.status}\n\n`
    }
    
    body += `Please let us know if you have any questions.\n\n` +
      `Quick - Mean - Tough!\n` +
      `AFC Zurich Renegades`
    
    // Build mailto URL
    const toParam = recipients.to.length > 0 ? recipients.to.join(',') : 'sports@renegades.ch'
    const ccParam = recipients.cc.length > 0 ? `&cc=${recipients.cc.join(',')}` : ''
    
    // Add importance header (note: mailto doesn't support importance, but we include it in subject)
    const mailtoUrl = `mailto:${toParam}?subject=${subject}&body=${encodeURIComponent(body)}${ccParam}`
    
    window.location.href = mailtoUrl
    toast.success('Email client opened')
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {updateType === 'cancel' ? (
              <Badge variant="destructive">Event Cancelled</Badge>
            ) : (
              <Badge variant="default">Event Updated</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Would you like to notify team managers and coaches about this {updateType === 'cancel' ? 'cancellation' : 'update'}?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Event Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-sm">{event.title || `${event.eventType}`}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(event.date)} • {event.startTime} - {event.endTime}
            </p>
            <p className="text-xs text-muted-foreground">{locationName}</p>
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
              Email will be sent to team managers with coaches and sports@renegades.ch in CC.
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex gap-2 w-full">
            <Button
              variant="default"
              className="flex-1"
              onClick={handleEmailShare}
            >
              <Envelope className="mr-2" size={18} weight="duotone" />
              Send Email
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleWhatsAppShare}
              disabled={sharing}
            >
              <WhatsappLogo className="mr-2" size={18} weight="duotone" />
              WhatsApp
            </Button>
          </div>
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
