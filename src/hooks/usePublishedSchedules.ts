import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, getToken } from '@/lib/api'
import type { Event, Field, PublishedSchedule, Site } from '@/lib/types'
import { publishedScheduleKey, publishedSites } from '@/lib/publishedSchedule'

export interface PublishedScheduleState {
  loading: boolean
  data?: PublishedSchedule
  error?: string
}

export function usePublishedSchedules(
  events: Event[], sites: Site[], fields: Field[], timezone: string | undefined, enabled: boolean,
) {
  const [results, setResults] = useState<Record<string, PublishedScheduleState>>({})
  const mounted = useRef(false)
  const pending = useRef(new Map<string, Promise<void>>())
  const attemptedAt = useRef(new Map<string, number>())
  const targets = useMemo(() => {
    const unique = new Map<string, { site: Site; date: string }>()
    for (const event of events) {
      for (const site of publishedSites(event, fields, sites)) {
        unique.set(publishedScheduleKey(site, event.date), { site, date: event.date })
      }
    }
    return [...unique.values()]
  }, [events, fields, sites])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const check = useCallback(async (site: Site, date: string) => {
    if (!enabled) return
    const key = publishedScheduleKey(site, date)
    if (pending.current.has(key)) return pending.current.get(key)
    const token = getToken()
    attemptedAt.current.set(key, Date.now())
    setResults(current => ({ ...current, [key]: { loading: true } }))
    const request = Promise.resolve().then(async () => {
      try {
        const data = await api.getPublishedSchedule(site.id, date)
        if (mounted.current && token === getToken()) {
          setResults(current => ({ ...current, [key]: { loading: false, data } }))
        }
      } catch (error) {
        console.error('Published schedule check failed:', error)
        if (mounted.current && token === getToken()) {
          setResults(current => ({ ...current, [key]: {
            loading: false, error: error instanceof Error ? error.message : 'Published schedule check failed',
          } }))
        }
      } finally {
        pending.current.delete(key)
      }
    })
    pending.current.set(key, request)
    return request
  }, [enabled])

  useEffect(() => {
    if (!enabled || !timezone || !targets.length) return
    let active = true
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      const today = new Intl.DateTimeFormat('sv-SE', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date())
      for (const { site, date } of targets) {
        if (!active || document.visibilityState !== 'visible') break
        const key = publishedScheduleKey(site, date)
        if (date === today && Date.now() - (attemptedAt.current.get(key) || 0) >= 60000) {
          await check(site, date)
        }
      }
    }
    const onVisible = () => { void refresh() }
    void refresh()
    const timer = window.setInterval(onVisible, 300000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, timezone, targets, check])

  return { results, check }
}
