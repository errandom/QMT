import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugDataLoader() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const testEndpoint = async (name: string, fn: () => Promise<any>) => {
    setLoading(true)
    try {
      console.log(`[DEBUG] Testing ${name}...`)
      const data = await fn()
      console.log(`[DEBUG] ${name} success:`, data)
      setResults(prev => ({ ...prev, [name]: data }))
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    } catch (error: any) {
      console.error(`[DEBUG] ${name} failed:`, error)
      setErrors(prev => ({ ...prev, [name]: error.message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('DebugDataLoader mounted')
  }, [])

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>API Debug Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button onClick={() => testEndpoint('getEvents', () => api.getEvents())}>
              Test Get Events
            </Button>
            <Button onClick={() => testEndpoint('getTeams', () => api.getTeams())}>
              Test Get Teams
            </Button>
            <Button onClick={() => testEndpoint('getSites', () => api.getSites())}>
              Test Get Sites
            </Button>
            <Button onClick={() => testEndpoint('getFields', () => api.getFields())}>
              Test Get Fields
            </Button>
            <Button onClick={() => testEndpoint('getEquipment', () => api.getEquipment())}>
              Test Get Equipment
            </Button>
          </div>

          {Object.entries(results).length > 0 && (
            <div>
              <h3 className="font-bold">Results:</h3>
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-96">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}

          {Object.entries(errors).length > 0 && (
            <div>
              <h3 className="font-bold text-red-600">Errors:</h3>
              <pre className="bg-red-100 p-2 rounded text-sm overflow-auto max-h-96">
                {JSON.stringify(errors, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
