import { useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { api } from '@/lib/api'

/**
 * Hook to initialize application data from the API on app startup
 * Fetches all necessary data and stores it in the KV store
 */
export function useInitializeData() {
  const [events, setEvents] = useKV<any[]>('events', [])
  const [teams, setTeams] = useKV<any[]>('teams', [])
  const [sites, setSites] = useKV<any[]>('sites', [])
  const [fields, setFields] = useKV<any[]>('fields', [])
  const [equipment, setEquipment] = useKV<any[]>('equipment', [])
  const [facilityRequests, setFacilityRequests] = useKV<any[]>('facility-requests', [])
  const [equipmentRequests, setEquipmentRequests] = useKV<any[]>('equipment-requests', [])
  const [cancellationRequests, setCancellationRequests] = useKV<any[]>('cancellation-requests', [])

  useEffect(() => {
    let isMounted = true
    const initializeData = async () => {
      try {
        console.log('========================================')
        console.log('[useInitializeData] 🚀 Starting data initialization...')
        console.log('========================================')
        
        // Fetch all data in parallel
        const results = await Promise.allSettled([
          api.getEvents(),
          api.getTeams(),
          api.getSites(),
          api.getFields(),
          api.getEquipment()
        ])

        if (!isMounted) {
          console.log('[useInitializeData] ⚠️ Component unmounted, aborting')
          return
        }

        const eventsData = results[0].status === 'fulfilled' ? results[0].value : []
        const teamsData = results[1].status === 'fulfilled' ? results[1].value : []
        const sitesData = results[2].status === 'fulfilled' ? results[2].value : []
        const fieldsData = results[3].status === 'fulfilled' ? results[3].value : []
        const equipmentData = results[4].status === 'fulfilled' ? results[4].value : []

        // Log each response in detail
        console.log('📊 [useInitializeData] API RESPONSES:')
        console.log(`   Events: ${eventsData.length} records`, eventsData)
        console.log(`   Teams: ${teamsData.length} records`, teamsData)
        console.log(`   Sites: ${sitesData.length} records`, sitesData)
        console.log(`   Fields: ${fieldsData.length} records`, fieldsData)
        console.log(`   Equipment: ${equipmentData.length} records`, equipmentData)

        // Log any errors
        if (results[0].status === 'rejected') console.error('[useInitializeData] ❌ Events API Error:', results[0].reason)
        if (results[1].status === 'rejected') console.error('[useInitializeData] ❌ Teams API Error:', results[1].reason)
        if (results[2].status === 'rejected') console.error('[useInitializeData] ❌ Sites API Error:', results[2].reason)
        if (results[3].status === 'rejected') console.error('[useInitializeData] ❌ Fields API Error:', results[3].reason)
        if (results[4].status === 'rejected') console.error('[useInitializeData] ❌ Equipment API Error:', results[4].reason)

        // Store data in KV store - with verification
        console.log('💾 [useInitializeData] Storing data into KV store...')
        
        console.log('   Setting events:', eventsData.length, 'items')
        setEvents(eventsData)
        
        console.log('   Setting teams:', teamsData.length, 'items')
        setTeams(teamsData)
        
        console.log('   Setting sites:', sitesData.length, 'items')
        setSites(sitesData)
        
        console.log('   Setting fields:', fieldsData.length, 'items')
        setFields(fieldsData)
        
        console.log('   Setting equipment:', equipmentData.length, 'items')
        setEquipment(equipmentData)

        // Initialize request collections as empty (populated by user submissions)
        console.log('   Setting requests (empty)...')
        setFacilityRequests([])
        setEquipmentRequests([])
        setCancellationRequests([])

        console.log('========================================')
        console.log('✅ [useInitializeData] Application data initialized successfully!')
        console.log('Summary:')
        console.log(`   Events: ${eventsData.length}`)
        console.log(`   Teams: ${teamsData.length}`)
        console.log(`   Sites: ${sitesData.length}`)
        console.log(`   Fields: ${fieldsData.length}`)
        console.log(`   Equipment: ${equipmentData.length}`)
        console.log('========================================')
      } catch (error) {
        console.error('========================================')
        console.error('❌ [useInitializeData] FATAL ERROR during initialization:')
        console.error(error)
        console.error('========================================')
      }
    }

    initializeData()
    
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once on mount
}
