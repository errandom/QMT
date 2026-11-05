import { useId } from 'react'
import type { MessageLanguage } from '@/lib/facilityWorkflow'

export default function MessageLanguageSwitch({ language, onChange }: {
  language: MessageLanguage
  onChange: (language: MessageLanguage) => void
}) {
  const id = useId()
  return <fieldset className="space-y-1">
    <legend className="text-sm font-medium">Message language</legend>
    <div className="flex flex-wrap gap-4">
      <label className="flex min-h-12 cursor-pointer items-center gap-2">
        <input type="radio" name={id} value="en" checked={language === 'en'} onChange={() => onChange('en')} />
        English
      </label>
      <label className="flex min-h-12 cursor-pointer items-center gap-2">
        <input type="radio" name={id} value="de" checked={language === 'de'} onChange={() => onChange('de')} />
        Deutsch (German)
      </label>
    </div>
    <p className="text-xs text-muted-foreground">Edits are kept separately in each language. Names, descriptions, notes and recorded conditions stay as entered.</p>
  </fieldset>
}
