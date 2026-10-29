import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode, Dispatch, SetStateAction } from 'react'
import { api, getToken } from '@/lib/api'
import type { Event, Team, Site, Field, Equipment, FacilityRequest, EquipmentRequest, CancellationRequest } from '@/lib/types'
import { withFieldSharing } from '@/lib/fieldSharing'

interface DataContextType {
  events: Event[]
  teams: Team[]
  sites: Site[]
  fields: Field[]
  equipment: Equipment[]
  facilityRequests: FacilityRequest[]
  equipmentRequests: EquipmentRequest[]
  cancellationRequests: CancellationRequest[]
  setEvents: Dispatch<SetStateAction<Event[]>>
  setTeams: Dispatch<SetStateAction<Team[]>>
  setSites: Dispatch<SetStateAction<Site[]>>
  setFields: Dispatch<SetStateAction<Field[]>>
  setEquipment: Dispatch<SetStateAction<Equipment[]>>
  setFacilityRequests: Dispatch<SetStateAction<FacilityRequest[]>>
  setEquipmentRequests: Dispatch<SetStateAction<EquipmentRequest[]>>
  setCancellationRequests: Dispatch<SetStateAction<CancellationRequest[]>>
  refreshData: (range?: { from: string; to: string }) => Promise<void>
  eventWindow: { from: string; to: string }
  refreshRequests: () => Promise<void>
  clearRequests: () => void
  isLoading: boolean
  error: string | null
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [storedEvents, setEvents] = useState<Event[]>([])
  const events = useMemo(() => withFieldSharing(storedEvents), [storedEvents])
  const [teams, setTeams] = useState<Team[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [facilityRequests, setFacilityRequests] = useState<FacilityRequest[]>([])
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequest[]>([])
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eventWindow, setEventWindow] = useState(() => ({
    from: new Date(Date.now() - 7 * 86400000).toISOString(),
    to: new Date(Date.now() + 90 * 86400000).toISOString(),
  }))
  const rangeRef = useRef(eventWindow)
  const inFlight = useRef<{ key: string; promise: Promise<void> } | null>(null)
  const requestGeneration = useRef(0)
  const dataGeneration = useRef(0)
  const refreshRequests = useCallback(async () => {
    const generation = ++requestGeneration.current
    const token = getToken()
    const requests = await api.getRequests()
    if (generation !== requestGeneration.current || token !== getToken()) return
    setFacilityRequests(requests.filter(request => request.type === 'facility'))
    setEquipmentRequests(requests.filter(request => request.type === 'equipment'))
    setCancellationRequests(requests.filter(request => request.type === 'cancellation'))
  }, [])
  const clearRequests = useCallback(() => {
    requestGeneration.current++
    setFacilityRequests([])
    setEquipmentRequests([])
    setCancellationRequests([])
  }, [])

  const refreshData = useCallback((range?: { from: string; to: string }) => {
    if (range) rangeRef.current = range
    const selectedWindow = rangeRef.current
    const token = getToken()
    const key = JSON.stringify([token, selectedWindow])
    if (inFlight.current?.key === key) return inFlight.current.promise
    const generation = ++dataGeneration.current
    if (!token) {
      setEvents([])
      setTeams([])
      setSites([])
      setFields([])
      setEquipment([])
    }
    setIsLoading(true)
    setError(null)
    const promise = Promise.all([
      api.getEvents(selectedWindow), api.getTeams(), api.getSites(), api.getFields(), api.getEquipment(),
    ]).then(([newEvents, newTeams, newSites, newFields, newEquipment]) => {
      if (generation !== dataGeneration.current || token !== getToken()) return
      setEvents(newEvents)
      setTeams(newTeams)
      setSites(newSites)
      setFields(newFields)
      setEquipment(newEquipment)
      setEventWindow(selectedWindow)
    }).catch(() => {
      if (generation !== dataGeneration.current || token !== getToken()) return
      setError('Data could not be refreshed. Previously loaded data may be stale; do not rely on an empty schedule.')
    }).finally(() => {
      if (generation !== dataGeneration.current) return
      if (token !== getToken()) {
        setEvents([])
        setTeams([])
        setSites([])
        setFields([])
        setEquipment([])
        clearRequests()
        setError('Your session changed. Sign in again or retry to reload the public schedule.')
      }
      setIsLoading(false)
      inFlight.current = null
    })
    inFlight.current = { key, promise }
    return promise
  }, [clearRequests])

  useEffect(() => { void refreshData() }, [refreshData])

  return (
    <DataContext.Provider value={{
      events, teams, sites, fields, equipment,
      facilityRequests, equipmentRequests, cancellationRequests,
      setEvents, setTeams, setSites, setFields, setEquipment,
      setFacilityRequests, setEquipmentRequests, setCancellationRequests,
      refreshData, refreshRequests, clearRequests, eventWindow, isLoading, error,
    }}>
      {error && <div role="alert" className="p-4 border border-destructive">
        {error} <button className="underline" onClick={() => void refreshData()}>Retry</button>
      </div>}
      {isLoading && <p role="status" className="p-4">Loading schedule...</p>}
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used within a DataProvider')
  return context
}
