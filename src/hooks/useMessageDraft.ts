import { useEffect, useRef, useState } from 'react'
import type { MessageLanguage } from '@/lib/facilityWorkflow'
import { messageTemplatesApi } from '@/lib/messageTemplates'
import type { MessageTemplateContent } from '../../server/message-template-domain.mjs'

export function useMessageDraft<T>(createDraft: (language: MessageLanguage, templates: readonly MessageTemplateContent[]) => T, emptyDraft: T) {
  const generator = useRef(createDraft)
  const templates = useRef<readonly MessageTemplateContent[]>([])
  const edited = useRef({ en: false, de: false })
  const [language, setLanguage] = useState<MessageLanguage>('en')
  const [initial] = useState(() => {
    try { return { drafts: { en: createDraft('en', []), de: createDraft('de', []) }, error: '' } }
    catch (error) { return { drafts: { en: emptyDraft, de: emptyDraft }, error: error instanceof Error ? error.message : 'Message draft could not be prepared' } }
  })
  const [drafts, setDrafts] = useState(initial.drafts)
  const [templateError, setTemplateError] = useState(initial.error)
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setTemplatesLoading(true); setTemplateError('')
    messageTemplatesApi.list().then(library => {
      if (!active) return
      const next = { en: generator.current('en', library), de: generator.current('de', library) }
      templates.current = library
      setDrafts(current => ({ en: edited.current.en ? current.en : next.en, de: edited.current.de ? current.de : next.de }))
    }).catch(error => {
      if (active) setTemplateError(error instanceof Error ? error.message : 'Template library unavailable')
    }).finally(() => { if (active) setTemplatesLoading(false) })
    return () => { active = false }
  }, [attempt])
  const setDraft = (draft: T) => {
    edited.current[language] = true
    setDrafts(current => ({ ...current, [language]: draft }))
  }
  const reset = (createNextDraft: (language: MessageLanguage, templates: readonly MessageTemplateContent[]) => T) => {
    generator.current = createNextDraft
    edited.current = { en: false, de: false }
    setLanguage('en')
    try {
      setDrafts({ en: createNextDraft('en', templates.current), de: createNextDraft('de', templates.current) })
      setTemplateError('')
    } catch (error) {
      setDrafts({ en: emptyDraft, de: emptyDraft })
      setTemplateError(error instanceof Error ? error.message : 'Message draft could not be prepared')
    }
    setTemplatesLoading(true)
    setAttempt(value => value + 1)
  }
  return { language, setLanguage, draft: drafts[language], setDraft, reset,
    templateError, templatesLoading, retryTemplates: () => setAttempt(value => value + 1), templates: templates.current }
}
