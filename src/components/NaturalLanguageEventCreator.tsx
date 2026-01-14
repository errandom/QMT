import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  MagicWand, 
  Lightning, 
  CalendarPlus, 
  ArrowsClockwise,
  Check,
  X,
  Calendar,
  Clock,
  Users,
  MapPin
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { COLORS } from '@/lib/constants'

interface ParsedEventPreview {
  title: string
  eventType: string
  date?: string
  startTime: string
  endTime: string
  teamIds: number[]
  fieldId?: number
  isRecurring: boolean
  recurringDays?: number[]
  recurringEndDate?: string
}

interface NaturalLanguageEventCreatorProps {
  onEventsCreated?: () => void
  teams?: { id: number; name: string }[]
  fields?: { id: number; name: string }[]
  sites?: { id: number; name: string }[]
}

export default function NaturalLanguageEventCreator({
  onEventsCreated,
  teams = [],
  fields = [],
  sites = [],
}: NaturalLanguageEventCreatorProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<{
    summary: string
    totalEvents: number
    events: ParsedEventPreview[]
  } | null>(null)

  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const examplePrompts = [
    "Schedule U19 practice every Tuesday and Thursday at 6pm from January 20 to March 30",
    "Create a game against Vålerenga for Seniors on February 15 at 2pm",
    "Add weekly U15 training on Wednesdays at 5pm at Ekeberg for 8 weeks",
    "Meeting for all coaches next Monday at 7pm",
  ]

  const handleParse = async () => {
    if (!input.trim()) {
      toast.error('Please enter an event description')
      return
    }

    setLoading(true)
    setPreview(null)

    try {
      const response = await fetch('/api/events/create-from-natural-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ input, confirm: false }),
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Could not parse the description')
        return
      }

      setPreview({
        summary: result.summary,
        totalEvents: result.totalEvents,
        events: result.events,
      })
    } catch (error) {
      toast.error('Failed to parse event description')
      console.error('[NLP] Parse error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/events/create-from-natural-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ input, confirm: true }),
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Failed to create events')
        return
      }

      toast.success(`Created ${result.created} event(s)!`)
      setInput('')
      setPreview(null)
      onEventsCreated?.()
    } catch (error) {
      toast.error('Failed to create events')
      console.error('[NLP] Create error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setPreview(null)
  }

  const getTeamName = (id: number) => teams.find(t => t.id === id)?.name || `Team ${id}`
  const getFieldName = (id: number) => fields.find(f => f.id === id)?.name || `Field ${id}`

  return (
    <Card className="border-2 border-dashed" style={{ borderColor: COLORS.ACCENT }}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${COLORS.ACCENT}, ${COLORS.NAVY})` }}
          >
            <MagicWand size={24} weight="fill" className="text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">AI Event Creator</CardTitle>
            <CardDescription>
              Describe events in plain English and let AI create them
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!preview ? (
          <>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Schedule U19 practice every Tuesday and Thursday at 6pm from January 20 to March 30"
              className="min-h-[100px] resize-none"
              disabled={loading}
            />

            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1 px-2"
                  onClick={() => setInput(prompt)}
                  disabled={loading}
                >
                  <Lightning size={12} className="mr-1" />
                  {prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}
                </Button>
              ))}
            </div>

            <Button
              onClick={handleParse}
              disabled={loading || !input.trim()}
              className="w-full"
              style={{ backgroundColor: COLORS.ACCENT }}
            >
              {loading ? (
                <ArrowsClockwise className="animate-spin mr-2" size={18} />
              ) : (
                <MagicWand size={18} className="mr-2" />
              )}
              {loading ? 'Analyzing...' : 'Create Events'}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-2">
                <Check size={20} weight="bold" />
                <span>Ready to create {preview.totalEvents} event(s)</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400">
                {preview.summary}
              </p>
            </div>

            {/* Event preview cards */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {preview.events.map((event, index) => (
                <div 
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-3 border shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{event.title}</span>
                    <Badge variant="secondary">{event.eventType}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{event.startTime} - {event.endTime}</span>
                    </div>
                    
                    {event.isRecurring && event.recurringDays ? (
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>
                          {event.recurringDays.map(d => dayNames[d]).join(', ')}
                        </span>
                      </div>
                    ) : event.date ? (
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{new Date(event.date).toLocaleDateString()}</span>
                      </div>
                    ) : null}
                    
                    {event.teamIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users size={14} />
                        <span>{event.teamIds.map(getTeamName).join(', ')}</span>
                      </div>
                    )}
                    
                    {event.fieldId && (
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        <span>{getFieldName(event.fieldId)}</span>
                      </div>
                    )}
                  </div>

                  {event.isRecurring && event.recurringEndDate && (
                    <div className="mt-2 text-xs text-gray-500">
                      Repeats until {new Date(event.recurringEndDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1"
              >
                <X size={18} className="mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1"
                style={{ backgroundColor: COLORS.ACCENT }}
              >
                {loading ? (
                  <ArrowsClockwise className="animate-spin mr-2" size={18} />
                ) : (
                  <CalendarPlus size={18} className="mr-2" />
                )}
                {loading ? 'Creating...' : `Create ${preview.totalEvents} Events`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
