import type { Event } from './types'
import { Team, Field, Site } from './types'
import { eventMessageDraft, type MessageAuthor } from './eventMessages'
import { requestMessageSignature, type MessageLanguage } from './facilityWorkflow'

export interface ShareConfig {
  groupPhone?: string  // Legacy: for fallback wa.me link
  enabled?: boolean
  preferNativeShare?: boolean  // Use native share sheet (recommended)
}

// Keep old name for backwards compatibility
export type WhatsAppConfig = ShareConfig

/**
 * Share a message using the native share sheet (works with WhatsApp groups, SMS, email, etc.)
 * Falls back to WhatsApp direct link or clipboard if native share is unavailable
 */
export async function shareMessage(message: string, title: string, config?: ShareConfig): Promise<boolean> {
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
  shareMessage(message, 'Club event', config)
}


export function notifyEventCreated(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  currentUser: MessageAuthor,
  language: MessageLanguage = 'en',
  config?: ShareConfig
): void {
  const draft = eventMessageDraft(event, null, 'create', teams, fields, sites, currentUser, language)
  shareMessage(draft.message, draft.subject, config)
}

export function notifyEventUpdated(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  currentUser: MessageAuthor,
  language: MessageLanguage = 'en',
  config?: ShareConfig
): void {
  const draft = eventMessageDraft(event, null, 'update', teams, fields, sites, currentUser, language)
  shareMessage(draft.message, draft.subject, config)
}

export function notifyEventCancelled(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  currentUser: MessageAuthor,
  language: MessageLanguage = 'en',
  config?: ShareConfig
): void {
  const draft = eventMessageDraft({ ...event, status: 'Cancelled' }, null, 'cancel', teams, fields, sites, currentUser, language)
  shareMessage(draft.message, draft.subject, config)
}

/**
 * Share an event directly using the native share sheet
 * This is called when user clicks the share button on an event card
 */
export async function shareEvent(
  event: Event,
  teams: Team[],
  fields: Field[],
  sites: Site[],
  currentUser: MessageAuthor,
  language: MessageLanguage = 'en',
): Promise<boolean> {
  const draft = eventMessageDraft(event, null, 'share', teams, fields, sites, currentUser, language)
  return shareMessage(draft.message, draft.subject)
}

export function notifyWeeklySummary(
  events: Event[],
  teams: Team[],
  fields: Field[],
  sites: Site[],
  currentUser: MessageAuthor,
  language: MessageLanguage = 'en',
  config?: ShareConfig
): void {
  if (!config) return

  const summary = language === 'de' ? '📊 *Wochenübersicht*\n\n' : '📊 *Weekly Schedule Summary*\n\n'
  const eventsList = events.map(e => {
    const date = new Date(`${e.date}T00:00:00Z`).toLocaleDateString(language === 'de' ? 'de-CH' : 'en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    })
    return `• ${date} ${e.startTime} - ${e.title}`
  }).join('\n')

  const message = summary + eventsList + `\n\n📅 ${language === 'de' ? 'Veranstaltungen insgesamt' : 'Total events'}: ${events.length}\n\n${requestMessageSignature(currentUser)}`
  shareMessage(message, language === 'de' ? 'Wochenplan' : 'Weekly Schedule', config)
}

/**
 * Check if native sharing is supported
 */
export function isNativeShareSupported(): boolean {
  return !!navigator.share
}
