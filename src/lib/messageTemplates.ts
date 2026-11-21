import { apiRequest, getToken } from './api'
import type { SavedMessageTemplate } from '../../server/message-template-domain.mjs'

const pending = new Map<string, Promise<SavedMessageTemplate[]>>()
export const messageTemplatesApi = {
  list: () => {
    const token = getToken() || ''
    const existing = pending.get(token)
    if (existing) return existing
    const request = apiRequest<SavedMessageTemplate[]>('/message-templates')
      .finally(() => pending.delete(token))
    pending.set(token, request)
    return request
  },
  save: (template: SavedMessageTemplate, subject: string, message: string, recipient: string) =>
    apiRequest<SavedMessageTemplate>(`/message-templates/${encodeURIComponent(template.key)}/${template.language}`, {
      method: 'PUT', body: JSON.stringify({ subject, message, recipient, expectedRevision: template.revision }),
    }),
  reset: (template: SavedMessageTemplate) =>
    apiRequest<SavedMessageTemplate>(`/message-templates/${encodeURIComponent(template.key)}/${template.language}/reset`, {
      method: 'POST', body: JSON.stringify({ expectedRevision: template.revision }),
    }),
}
