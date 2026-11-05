import { useState } from 'react'
import type { MessageLanguage } from '@/lib/facilityWorkflow'

export function useMessageDraft<T>(createDraft: (language: MessageLanguage) => T) {
  const [language, setLanguage] = useState<MessageLanguage>('en')
  const [drafts, setDrafts] = useState(() => ({ en: createDraft('en'), de: createDraft('de') }))
  const setDraft = (draft: T) => setDrafts(current => ({ ...current, [language]: draft }))
  const reset = (createNextDraft: (language: MessageLanguage) => T) => {
    setLanguage('en')
    setDrafts({ en: createNextDraft('en'), de: createNextDraft('de') })
  }
  return { language, setLanguage, draft: drafts[language], setDraft, reset }
}
