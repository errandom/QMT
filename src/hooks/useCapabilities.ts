import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'

export interface Capabilities {
  ai: boolean
  spond: boolean
  weather: boolean
  clubName: string
  timezone: string
  transport: boolean
}

let pending: Promise<Capabilities> | undefined

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    pending ??= apiRequest<Capabilities>('/capabilities', { headers: { Authorization: '' } })
    void pending.then(value => {
      if (active) setCapabilities(value)
    }).catch(() => {
      pending = undefined
      if (active) setError('Deployment capabilities are unavailable; integrations remain disabled.')
    })
    return () => { active = false }
  }, [])
  return { capabilities, error }
}
