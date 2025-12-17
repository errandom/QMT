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
    const initializeData = async () => {
      try {
        // Fetch all data in parallel
        const [eventsData, teamsData, sitesData, fieldsData, equipmentData] = await Promise.all([
          api.getEvents().catch(err => {
            console.error('Failed to load events:', err)
            return []
          }),
          api.getTeams().catch(err => {
            console.error('Failed to load teams:', err)
            return []
          }),
          api.getSites().catch(err => {
            console.error('Failed to load sites:', err)
            return []
          }),
          api.getFields().catch(err => {
            console.error('Failed to load fields:', err)
            return []
          }),
          api.getEquipment().catch(err => {
            console.error('Failed to load equipment:', err)
            return []
          })
        ])

        // Store data in KV store
        setEvents(eventsData)
        setTeams(teamsData)
        setSites(sitesData)
        setFields(fieldsData)
        setEquipment(equipmentData)

        // Initialize request collections as empty (populated by user submissions)
        setFacilityRequests([])
        setEquipmentRequests([])
        setCancellationRequests([])

        console.log('✓ Application data initialized successfully')
      } catch (error) {
        console.error('Failed to initialize application data:', error)
      }
    }

    initializeData()
  }, [setEvents, setTeams, setSites, setFields, setEquipment, setFacilityRequests, setEquipmentRequests, setCancellationRequests])
}
