import type { Event } from './types'
import { Team, Field, Site } from './types'

export interface ShareConfig {
  groupPhone?: string  // Legacy: for fallback wa.me link
  enabled?: boolean
  preferNativeShare?: boolean  // Use native share sheet (recommended)
}

// Keep old name for backwards compatibility
export type WhatsAppConfig = ShareConfig

function formatEventMessage(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[]
): string {
  const statusEmoji = event.status === 'Cancelled' ? '❌' : 
                      event.status === 'Confirmed' ? '✅' : 
                      event.status === 'Completed' ? '🏁' : '📋'
  
  const typeEmoji = event.eventType === 'Game' ? '🏈' : 
                    event.eventType === 'Practice' ? '🏃' : 
                    event.eventType === 'Meeting' ? '💼' : '📌'

  const teamNames = event.teamIds
    .map(id => teams.find(t => t.id === id)?.name || 'Unknown')
    .join(', ')

  // Support multiple fields
  const eventFieldIds = event.fieldIds || []
  const eventFields = eventFieldIds.map(id => fields.find(f => f.id === id)).filter(Boolean)
  const primaryField = eventFields[0]
  const site = primaryField ? sites.find(s => s.id === primaryField.siteId) : null
  const fieldNames = eventFields.map(f => f?.name).join(', ')
  const location = site && fieldNames ? `${site.name} - ${fieldNames}` : fieldNames || 'TBD'

  const date = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  // Calculate duration if both times are available
  let duration = 90 // default
  if (event.startTime && event.endTime) {
    const [startHour, startMin] = event.startTime.split(':').map(Number)
    const [endHour, endMin] = event.endTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    duration = endMinutes - startMinutes
  }

  return (
    `${statusEmoji} ${typeEmoji} *${event.title || event.eventType}*\n\n` +
    `🕐 ${event.startTime || 'TBD'} - ${event.endTime || 'TBD'} (${duration} min)\n` +
    `📅 ${date}\n` +
    `👥 ${teamNames || 'No teams assigned'}\n` +
    `📍 ${location}\n` +
    (event.notes ? `\n📝 ${event.notes}` : '')
  )
}

/**
 * Share a message using the native share sheet (works with WhatsApp groups, SMS, email, etc.)
 * Falls back to WhatsApp direct link or clipboard if native share is unavailable
 */
async function shareMessage(message: string, title: string, config?: ShareConfig): Promise<boolean> {
  // Try native share first (works with WhatsApp groups!)
  if (navigator.share && config?.preferNativeShare !== false) {
    try {
      await navigator.share({
        title: title,
        text: message
      })
      return true
    } catch (err) {
      // User cancelled or share failed - try fallback
      if ((err as Error).name === 'AbortError') {
        return false // User cancelled, don't fallback
      }
    }
  }

  // Fallback: WhatsApp Web link (only works with individual numbers)
  if (config?.groupPhone) {
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://web.whatsapp.com/send?phone=${config.groupPhone}&text=${encodedMessage}`
    window.open(whatsappUrl, '_blank')
    return true
  }

  // Last resort: Copy to clipboard
  try {
    await navigator.clipboard.writeText(message)
    // Could show a toast here: "Message copied to clipboard"
    return true
  } catch {
    console.error('Failed to copy to clipboard')
    return false
  }
}

// Legacy function name for backwards compatibility
function sendWhatsAppNotification(message: string, config: ShareConfig): void {
  shareMessage(message, 'Renegades Event', config)
}


export function notifyEventCreated(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  config?: ShareConfig
): void {
  const message = `🆕 *New Event Created*\n\n${formatEventMessage(event, teams, fields, sites)}`
  shareMessage(message, 'New Event Created', config)
}

export function notifyEventUpdated(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  config?: ShareConfig
): void {
  const message = `✏️ *Event Updated*\n\n${formatEventMessage(event, teams, fields, sites)}`
  shareMessage(message, 'Event Updated', config)
}

export function notifyEventCancelled(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  config?: ShareConfig
): void {
  const message = `❌ *Event Cancelled*\n\n${formatEventMessage(event, teams, fields, sites)}`
  shareMessage(message, 'Event Cancelled', config)
}

/**
 * Share an event directly using the native share sheet
 * This is called when user clicks the share button on an event card
 */
export async function shareEvent(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[]
): Promise<boolean> {
  const message = formatEventMessage(event, teams, fields, sites)
  return shareMessage(message, event.title || event.eventType)
}

export function notifyWeeklySummary(
  events: Event[],
  teams: Team[],
  fields: Field[],
  sites: Site[],
  config?: ShareConfig
): void {
  if (!config) return

  const summary = `📊 *Weekly Schedule Summary*\n\n`
  const eventsList = events.map(e => {
    const date = new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return `• ${date} ${e.startTime} - ${e.title}`
  }).join('\n')

  const message = summary + eventsList + `\n\n📅 Total events: ${events.length}`
  shareMessage(message, 'Weekly Schedule', config)
}

/**
 * Check if native sharing is supported
 */
export function isNativeShareSupported(): boolean {
  return !!navigator.share
}
