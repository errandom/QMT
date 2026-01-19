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
  MapPin,
  Warning,
  Info,
  CheckCircle
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { getToken } from '@/lib/api'
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

interface CompletenessCheck {
  hasTime: boolean
  hasDate: boolean
  hasTeam: boolean
  hasVenue: boolean
  hasEventType: boolean
  suggestions: string[]
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
  const [completeness, setCompleteness] = useState<CompletenessCheck | null>(null)
  const [preview, setPreview] = useState<{
    summary: string
    totalEvents: number
    events: ParsedEventPreview[]
  } | null>(null)

  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Check input for completeness before sending to AI
  const checkCompleteness = (text: string): CompletenessCheck => {
    const lowerText = text.toLowerCase()
    const suggestions: string[] = []

    // Check for time patterns
    const hasTime = /\d{1,2}(:\d{2})?\s*(am|pm|o'clock)|at\s+\d{1,2}|\d{2}:\d{2}/i.test(text)
    if (!hasTime) {
      suggestions.push('Add a start time (e.g., "at 6pm" or "at 18:00")')
    }

    // Check for date patterns
    const hasDate = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|next\s+week|tomorrow|every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))/i.test(text)
    if (!hasDate) {
      suggestions.push('Specify when (e.g., "on January 25" or "every Tuesday")')
    }

    // Check for team mentions
    const teamNames = teams.map(t => t.name.toLowerCase())
    const hasTeam = teamNames.some(name => lowerText.includes(name.toLowerCase())) ||
                    /\b(u\d+|seniors?|juniors?|veterans?|womens?|mens?|all\s+teams|coaches)\b/i.test(text)
    if (!hasTeam) {
      suggestions.push('Mention which team (e.g., "U19" or "Seniors")')
    }

    // Check for venue/location
    const siteNames = sites.map(s => s.name.toLowerCase())
    const fieldNames = fields.map(f => f.name.toLowerCase())
    const hasVenue = siteNames.some(name => lowerText.includes(name)) ||
                     fieldNames.some(name => lowerText.includes(name)) ||
                     /\b(at|venue|field|pitch|stadium|hall|gym|indoor|outdoor)\b/i.test(text)
    if (!hasVenue) {
      suggestions.push('Add a location (e.g., "at Ekeberg" or "Field 1")')
    }

    // Check for event type
    const hasEventType = /\b(practice|training|game|match|meeting|scrimmage|workout|session|camp|tournament|friendly)\b/i.test(text)
    if (!hasEventType) {
      suggestions.push('Specify event type (e.g., "practice", "game", or "meeting")')
    }

    return { hasTime, hasDate, hasTeam, hasVenue, hasEventType, suggestions }
  }

  // Update completeness check when input changes
  const handleInputChange = (value: string) => {
    setInput(value)
    if (value.trim().length > 10) {
      setCompleteness(checkCompleteness(value))
    } else {
      setCompleteness(null)
    }
  }

  const examplePrompts = [
    "Schedule U19 practice every Tuesday and Thursday at 6pm at Ekeberg from January 20 to March 30",
    "Create a home game against Vålerenga for Seniors on February 15 at 2pm at Field 1",
    "Add weekly U15 training on Wednesdays at 5pm at Ekeberg for 8 weeks",
    "Coaches meeting next Monday at 7pm in the clubhouse",
  ]

  const handleParse = async () => {
    if (!input.trim()) {
      toast.error('Please enter an event description')
      return
    }

    // Check completeness and warn if missing critical info
    const check = checkCompleteness(input)
    if (!check.hasTime || !check.hasDate) {
      toast.error('Please specify both a date and time for the event')
      setCompleteness(check)
      return
    }

    setLoading(true)
    setPreview(null)

    try {
      const response = await fetch('/api/events/create-from-natural-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ input, confirm: false }),
      })

      if (response.status === 404) {
        toast.error('AI service not available. Please check server configuration.')
        console.error('[NLP] 404 - Endpoint not found. Make sure the server is running with the events routes.')
        return
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[NLP] Server error:', response.status, errorText)
        toast.error(`Server error: ${response.status}`)
        return
      }

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Could not parse the description')
        return
      }

      // Validate the parsed result has required fields
      if (result.events && result.events.length > 0) {
        const firstEvent = result.events[0]
        const missingFields: string[] = []
        
        if (!firstEvent.startTime) missingFields.push('start time')
        if (!firstEvent.date && !firstEvent.isRecurring) missingFields.push('date')
        if (firstEvent.teamIds?.length === 0) missingFields.push('team')
        
        if (missingFields.length > 0) {
          toast.warning(`Please clarify: ${missingFields.join(', ')}`)
        }
      }

      setPreview({
        summary: result.summary,
        totalEvents: result.totalEvents,
        events: result.events,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to parse event: ${errorMessage}`)
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
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ input, confirm: true }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[NLP] Server error:', response.status, errorText)
        toast.error(`Server error: ${response.status}`)
        return
      }

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to create events: ${errorMessage}`)
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
    <Card className="border-2 border-dashed border-purple-400">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}
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
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="e.g., Schedule U19 practice every Tuesday and Thursday at 6pm at Ekeberg from January 20 to March 30"
              className="min-h-[100px] resize-none"
              disabled={loading}
            />

            {/* Completeness indicators */}
            {completeness && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Info size={16} />
                  Event Details Check
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                  <div className={`flex items-center gap-1 ${completeness.hasEventType ? 'text-green-600' : 'text-amber-600'}`}>
                    {completeness.hasEventType ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} />}
                    <span>Type</span>
                  </div>
                  <div className={`flex items-center gap-1 ${completeness.hasDate ? 'text-green-600' : 'text-red-500'}`}>
                    {completeness.hasDate ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} />}
                    <span>Date</span>
                  </div>
                  <div className={`flex items-center gap-1 ${completeness.hasTime ? 'text-green-600' : 'text-red-500'}`}>
                    {completeness.hasTime ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} />}
                    <span>Time</span>
                  </div>
                  <div className={`flex items-center gap-1 ${completeness.hasTeam ? 'text-green-600' : 'text-amber-600'}`}>
                    {completeness.hasTeam ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} />}
                    <span>Team</span>
                  </div>
                  <div className={`flex items-center gap-1 ${completeness.hasVenue ? 'text-green-600' : 'text-amber-600'}`}>
                    {completeness.hasVenue ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} />}
                    <span>Venue</span>
                  </div>
                </div>
                
                {completeness.suggestions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Suggestions:</p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      {completeness.suggestions.slice(0, 3).map((suggestion, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <span className="text-amber-500">•</span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1 px-2"
                  onClick={() => handleInputChange(prompt)}
                  disabled={loading}
                >
                  <Lightning size={12} className="mr-1" />
                  {prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}
                </Button>
              ))}
            </div>

            <Button
              onClick={handleParse}
              disabled={loading || !input.trim() || (completeness !== null && (!completeness.hasTime || !completeness.hasDate))}
              className="w-full"
              style={{ 
                backgroundColor: completeness && (!completeness.hasTime || !completeness.hasDate) 
                  ? '#94a3b8' 
                  : '#8B5CF6' 
              }}
            >
              {loading ? (
                <ArrowsClockwise className="animate-spin mr-2" size={18} />
              ) : (
                <MagicWand size={18} className="mr-2" />
              )}
              {loading 
                ? 'Analyzing...' 
                : completeness && (!completeness.hasTime || !completeness.hasDate)
                  ? 'Add date & time to continue'
                  : 'Create Events'
              }
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
                    ) : (
                      <div className="flex items-center gap-1 text-amber-500">
                        <Warning size={14} />
                        <span className="italic">No date set</span>
                      </div>
                    )}
                    
                    {event.teamIds.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <Users size={14} />
                        <span>{event.teamIds.map(getTeamName).join(', ')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-500">
                        <Warning size={14} />
                        <span className="italic">No team assigned</span>
                      </div>
                    )}
                    
                    {event.fieldId ? (
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        <span>{getFieldName(event.fieldId)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-500">
                        <Warning size={14} />
                        <span className="italic">No venue set</span>
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
                style={{ backgroundColor: '#8B5CF6' }}
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
