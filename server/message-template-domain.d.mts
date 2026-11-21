export interface MessageTemplateContent { key: string; language: 'en' | 'de'; subject: string; message: string; recipient?: string }
export interface MessageTemplateDefinition extends MessageTemplateContent {
  name: string; required: readonly string[]; placeholders: readonly string[]; recipient: string; recipientLimit: number
}
export interface SavedMessageTemplate extends MessageTemplateDefinition {
  revision: number; customized: boolean; updatedBy: string | null; updatedAt: string | null
}
export const templateCatalog: readonly MessageTemplateDefinition[]
export function templateDefinition(key: string, language: 'en' | 'de'): MessageTemplateDefinition
export function validateTemplate(definition: MessageTemplateDefinition, content: Pick<MessageTemplateContent, 'subject' | 'message' | 'recipient'>): Pick<MessageTemplateContent, 'subject' | 'message' | 'recipient'>
export function validateRecipient(definition: MessageTemplateDefinition, recipient: string): string[]
export function templateRecipients(key: string, language: 'en' | 'de', automatic: string[], overrides?: readonly MessageTemplateContent[]): string[]
export function renderTemplate(key: string, language: 'en' | 'de', values: Record<string, string>, overrides?: readonly MessageTemplateContent[]): { subject: string; message: string }
export function renderTemplateSubject(key: string, language: 'en' | 'de', values: Record<string, string>, overrides?: readonly MessageTemplateContent[]): string
