import type { Event } from './types'
import { Team, Field, Site } from './types'

export interface WhatsAppConfig {
  groupPhone?: string
  enabled?: boolean
}

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

  const field = fields.find(f => f.id === event.fieldId)
  const site = field ? sites.find(s => s.id === field.siteId) : null
  const location = site ? `${site.name} - ${field?.name}` : 'TBD'

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

function sendWhatsAppNotification(message: string, config: WhatsAppConfig): void {
  if (!config.groupPhone || !config.enabled) return
  
  const encodedMessage = encodeURIComponent(message)
  const whatsappUrl = `https://wa.me/${config.groupPhone}?text=${encodedMessage}`
  
  window.open(whatsappUrl, '_blank')
}


export function notifyEventCreated(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  config?: WhatsAppConfig
): void {
  if (!config) return

  const message = `🆕 *New Event Created*\n\n${formatEventMessage(event, teams, fields, sites)}`
  sendWhatsAppNotification(message, config)
}

export function notifyEventUpdated(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  config?: WhatsAppConfig
): void {
  if (!config) return

  const message = `✏️ *Event Updated*\n\n${formatEventMessage(event, teams, fields, sites)}`
  sendWhatsAppNotification(message, config)
}

export function notifyEventCancelled(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  config?: WhatsAppConfig
): void {
  if (!config) return

  const message = `❌ *Event Cancelled*\n\n${formatEventMessage(event, teams, fields, sites)}`
  sendWhatsAppNotification(message, config)
}

export function notifyWeeklySummary(
  events: Event[],
  teams: Team[],
  fields: Field[],
  sites: Site[],
  config?: WhatsAppConfig
): void {
  if (!config) return

  const summary = `📊 *Weekly Schedule Summary*\n\n`
  const eventsList = events.map(e => {
    const date = new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return `• ${date} ${e.startTime} - ${e.title}`
  }).join('\n')

  const message = summary + eventsList + `\n\n📅 Total events: ${events.length}`
  sendWhatsAppNotification(message, config)
}
