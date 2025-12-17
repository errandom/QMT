import { useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { api } from '@/lib/api'

/**
 * Hook to initialize application data from the API on app startup
 * Fetches all necessary data and stores it in the KV store
 */
export function useInitializeData() {
  const [, setEvents] = useKV<any[]>('events', [])
  const [, setTeams] = useKV<any[]>('teams', [])
  const [, setSites] = useKV<any[]>('sites', [])
  const [, setFields] = useKV<any[]>('fields', [])
  const [, setEquipment] = useKV<any[]>('equipment', [])
  const [, setFacilityRequests] = useKV<any[]>('facility-requests', [])
  const [, setEquipmentRequests] = useKV<any[]>('equipment-requests', [])
  const [, setCancellationRequests] = useKV<any[]>('cancellation-requests', [])

  useEffect(() => {
    let isMounted = true
    const initializeData = async () => {
      try {
        console.log('[useInitializeData] Starting data initialization...')
        
        // Fetch all data in parallel
        const results = await Promise.allSettled([
          api.getEvents(),
          api.getTeams(),
          api.getSites(),
          api.getFields(),
          api.getEquipment()
        ])

        if (!isMounted) return

        const eventsData = results[0].status === 'fulfilled' ? results[0].value : []
        const teamsData = results[1].status === 'fulfilled' ? results[1].value : []
        const sitesData = results[2].status === 'fulfilled' ? results[2].value : []
        const fieldsData = results[3].status === 'fulfilled' ? results[3].value : []
        const equipmentData = results[4].status === 'fulfilled' ? results[4].value : []

        // Detailed logging for debugging
        console.log('[useInitializeData] Events API Response:', eventsData)
        console.log('[useInitializeData] Teams API Response:', teamsData)
        console.log('[useInitializeData] Sites API Response:', sitesData)
        console.log('[useInitializeData] Fields API Response:', fieldsData)
        console.log('[useInitializeData] Equipment API Response:', equipmentData)

        if (results[0].status === 'rejected') console.error('[useInitializeData] Failed to load events:', results[0].reason)
        if (results[1].status === 'rejected') console.error('[useInitializeData] Failed to load teams:', results[1].reason)
        if (results[2].status === 'rejected') console.error('[useInitializeData] Failed to load sites:', results[2].reason)
        if (results[3].status === 'rejected') console.error('[useInitializeData] Failed to load fields:', results[3].reason)
        if (results[4].status === 'rejected') console.error('[useInitializeData] Failed to load equipment:', results[4].reason)

        // Store data in KV store
        console.log('[useInitializeData] Storing data into KV store:', { 
          events: eventsData.length, 
          teams: teamsData.length, 
          sites: sitesData.length, 
          fields: fieldsData.length, 
          equipment: equipmentData.length 
        })
        setEvents(eventsData)
        setTeams(teamsData)
        setSites(sitesData)
        setFields(fieldsData)
        setEquipment(equipmentData)

        // Initialize request collections as empty (populated by user submissions)
        setFacilityRequests([])
        setEquipmentRequests([])
        setCancellationRequests([])

        console.log('✓ [useInitializeData] Application data initialized successfully')
      } catch (error) {
        console.error('[useInitializeData] Failed to initialize application data:', error)
      }
    }

    initializeData()
    
    return () => {
      isMounted = false
    }
  }, [setEvents, setTeams, setSites, setFields, setEquipment, setFacilityRequests, setEquipmentRequests, setCancellationRequests])
}
