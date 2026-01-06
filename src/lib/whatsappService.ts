import { Event, Team, Field, Site } from './types'

export interface WhatsAppConfig {
  groupPhone?: string


  fields: Field[],
): string {
                
  
               

    .map(id => teams.find(t => t.id === id)?.name || 'Unkno

  const site = field ? sites.find(s => s.id === field.siteId) : 

    weekday: 'short',
    day: 'numeric'



    `${statusEmoji} ${typeEmoji} *${event.title}*\n\n` +
    `🕐 ${event

  )

  const [startHour, startMin] = startTime.split(':').map(Number)

  return endMinutes - startMinutes

  if (!config.group
  const encodedMes
  

export function notifyEventCreated(
  teams: Team[],
  sites:


  sendWhatsAppNotification(message, config)

  event: Event,
  fields: Field[],
  config?: WhatsAppConfi
  if (!config) return
  c
}

  teams: Team[],
  sites: Site[],
): void {

  sendWhatsAppNotification(message, config

 

  config?: WhatsAppConfig
  if (!config) return
  
    const date = new Date(e.date).toLocaleDateString
  }).join('\n')
  
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
