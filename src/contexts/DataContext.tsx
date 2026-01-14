import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '@/lib/api'

interface DataContextType {
  events: any[]
  teams: any[]
  sites: any[]
  fields: any[]
  equipment: any[]
  facilityRequests: any[]
  equipmentRequests: any[]
  cancellationRequests: any[]
  setEvents: (events: any[] | ((prev: any[]) => any[])) => void
  setTeams: (teams: any[] | ((prev: any[]) => any[])) => void
  setSites: (sites: any[] | ((prev: any[]) => any[])) => void
  setFields: (fields: any[] | ((prev: any[]) => any[])) => void
  setEquipment: (equipment: any[] | ((prev: any[]) => any[])) => void
  setFacilityRequests: (requests: any[] | ((prev: any[]) => any[])) => void
  setEquipmentRequests: (requests: any[] | ((prev: any[]) => any[])) => void
  setCancellationRequests: (requests: any[] | ((prev: any[]) => any[])) => void
  refreshData: () => Promise<void>
  isLoading: boolean
}

const DataContext = createContext<DataContextType | undefined>(undefined)

const STORAGE_KEYS = {
  events: 'app_events',
  teams: 'app_teams',
  sites: 'app_sites',
  fields: 'app_fields',
  equipment: 'app_equipment',
  facilityRequests: 'app_facility_requests',
  equipmentRequests: 'app_equipment_requests',
  cancellationRequests: 'app_cancellation_requests',
}

// Helper to safely parse JSON from localStorage
function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key)
    // Handle cases where item is null, undefined, or the string "undefined"
    if (!item || item === 'undefined' || item === 'null') {
      return defaultValue
    }
    return JSON.parse(item)
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error)
    return defaultValue
  }
}

// Helper to safely save to localStorage
function saveToStorage(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error)
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  
  // Initialize state from localStorage
  const [events, setEventsState] = useState<any[]>(() => getFromStorage(STORAGE_KEYS.events, []))
  const [teams, setTeamsState] = useState<any[]>(() => getFromStorage(STORAGE_KEYS.teams, []))
  const [sites, setSitesState] = useState<any[]>(() => getFromStorage(STORAGE_KEYS.sites, []))
  const [fields, setFieldsState] = useState<any[]>(() => getFromStorage(STORAGE_KEYS.fields, []))
  const [equipment, setEquipmentState] = useState<any[]>(() => getFromStorage(STORAGE_KEYS.equipment, []))
  const [facilityRequests, setFacilityRequestsState] = useState<any[]>(() => getFromStorage(STORAGE_KEYS.facilityRequests, []))
  const [equipmentRequests, setEquipmentRequestsState] = useState<any[]>(() => getFromStorage(STORAGE_KEYS.equipmentRequests, []))
  const [cancellationRequests, setCancellationRequestsState] = useState<any[]>(() => getFromStorage(STORAGE_KEYS.cancellationRequests, []))

  // Wrapper functions that also save to localStorage
  const setEvents = (data: any[] | ((prev: any[]) => any[])) => {
    const newData = typeof data === 'function' ? data(events) : data
    setEventsState(newData)
    saveToStorage(STORAGE_KEYS.events, newData)
  }

  const setTeams = (data: any[] | ((prev: any[]) => any[])) => {
    const newData = typeof data === 'function' ? data(teams) : data
    setTeamsState(newData)
    saveToStorage(STORAGE_KEYS.teams, newData)
  }

  const setSites = (data: any[] | ((prev: any[]) => any[])) => {
    const newData = typeof data === 'function' ? data(sites) : data
    setSitesState(newData)
    saveToStorage(STORAGE_KEYS.sites, newData)
  }

  const setFields = (data: any[] | ((prev: any[]) => any[])) => {
    const newData = typeof data === 'function' ? data(fields) : data
    setFieldsState(newData)
    saveToStorage(STORAGE_KEYS.fields, newData)
  }

  const setEquipment = (data: any[] | ((prev: any[]) => any[])) => {
    const newData = typeof data === 'function' ? data(equipment) : data
    setEquipmentState(newData)
    saveToStorage(STORAGE_KEYS.equipment, newData)
  }

  const setFacilityRequests = (data: any[] | ((prev: any[]) => any[])) => {
    const newData = typeof data === 'function' ? data(facilityRequests) : data
    setFacilityRequestsState(newData)
    saveToStorage(STORAGE_KEYS.facilityRequests, newData)
  }

  const setEquipmentRequests = (data: any[] | ((prev: any[]) => any[])) => {
    const newData = typeof data === 'function' ? data(equipmentRequests) : data
    setEquipmentRequestsState(newData)
    saveToStorage(STORAGE_KEYS.equipmentRequests, newData)
  }

  const setCancellationRequests = (data: any[] | ((prev: any[]) => any[])) => {
    const newData = typeof data === 'function' ? data(cancellationRequests) : data
    setCancellationRequestsState(newData)
    saveToStorage(STORAGE_KEYS.cancellationRequests, newData)
  }

  // Fetch all data from API
  const refreshData = async () => {
    try {
      console.log('========================================')
      console.log('[DataProvider] 🚀 Starting data initialization...')
      console.log('========================================')
      
      setIsLoading(true)
      const startTime = Date.now()
      
      // First, warm up the database connection (handles serverless DB wake-up)
      try {
        console.log('[DataProvider] ⏳ Warming up database connection...')
        const warmupResponse = await fetch('/api/warmup')
        const warmupData = await warmupResponse.json()
        const warmupTime = Date.now() - startTime
        console.log(`[DataProvider] 🔥 Database warm-up completed in ${warmupTime}ms`, warmupData)
        
        if (warmupData.timing?.totalMs > 5000) {
          console.log('[DataProvider] ⚠️ Database was cold (serverless paused). This caused the delay.')
        }
      } catch (warmupError) {
        console.warn('[DataProvider] ⚠️ Warmup call failed, continuing anyway:', warmupError)
      }
      
      // Fetch all data in parallel
      const results = await Promise.allSettled([
        api.getEvents(),
        api.getTeams(),
        api.getSites(),
        api.getFields(),
        api.getEquipment()
      ])

      const eventsData = results[0].status === 'fulfilled' ? results[0].value : []
      const teamsData = results[1].status === 'fulfilled' ? results[1].value : []
      const sitesData = results[2].status === 'fulfilled' ? results[2].value : []
      const fieldsData = results[3].status === 'fulfilled' ? results[3].value : []
      const equipmentData = results[4].status === 'fulfilled' ? results[4].value : []

      // Log responses
      console.log('📊 [DataProvider] API RESPONSES:')
      console.log(`   Events: ${eventsData.length} records`, eventsData)
      console.log(`   Teams: ${teamsData.length} records`, teamsData)
      console.log(`   Sites: ${sitesData.length} records`, sitesData)
      console.log(`   Fields: ${fieldsData.length} records`, fieldsData)
      console.log(`   Equipment: ${equipmentData.length} records`, equipmentData)

      // Log any errors
      if (results[0].status === 'rejected') console.error('[DataProvider] ❌ Events API Error:', results[0].reason)
      if (results[1].status === 'rejected') console.error('[DataProvider] ❌ Teams API Error:', results[1].reason)
      if (results[2].status === 'rejected') console.error('[DataProvider] ❌ Sites API Error:', results[2].reason)
      if (results[3].status === 'rejected') console.error('[DataProvider] ❌ Fields API Error:', results[3].reason)
      if (results[4].status === 'rejected') console.error('[DataProvider] ❌ Equipment API Error:', results[4].reason)

      // Store data (automatically saves to localStorage via setters)
      console.log('💾 [DataProvider] Storing data...')
      setEvents(eventsData)
      setTeams(teamsData)
      setSites(sitesData)
      setFields(fieldsData)
      setEquipment(equipmentData)

      console.log('========================================')
      console.log('✅ [DataProvider] Data initialized successfully!')
      console.log(`   Events: ${eventsData.length}`)
      console.log(`   Teams: ${teamsData.length}`)
      console.log(`   Sites: ${sitesData.length}`)
      console.log(`   Fields: ${fieldsData.length}`)
      console.log(`   Equipment: ${equipmentData.length}`)
      console.log('========================================')
    } catch (error) {
      console.error('========================================')
      console.error('❌ [DataProvider] FATAL ERROR during initialization:')
      console.error(error)
      console.error('========================================')
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    refreshData()
  }, [])

  const value: DataContextType = {
    events,
    teams,
    sites,
    fields,
    equipment,
    facilityRequests,
    equipmentRequests,
    cancellationRequests,
    setEvents,
    setTeams,
    setSites,
    setFields,
    setEquipment,
    setFacilityRequests,
    setEquipmentRequests,
    setCancellationRequests,
    refreshData,
    isLoading,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
