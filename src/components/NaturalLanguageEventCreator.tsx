import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  fields?: { id: number; name: string; siteId?: number | string }[]
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
  const [defaultTeamId, setDefaultTeamId] = useState<string>('')
  const [defaultFieldId, setDefaultFieldId] = useState<string>('')

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
        body: JSON.stringify({ 
          input, 
          confirm: false,
          defaultTeamId: defaultTeamId && defaultTeamId !== 'none' ? parseInt(defaultTeamId) : undefined,
          defaultFieldId: defaultFieldId && defaultFieldId !== 'none' ? parseInt(defaultFieldId) : undefined,
        }),
      })

      if (response.status === 404) {
        toast.error('AI service not available. The backend API server is not running. Please start it with: npm run start')
        console.error('[NLP] 404 - Endpoint not found. The backend server (server.js) needs to be running for AI features.')
        return
      }

      if (!response.ok) {
        let errorText = ''
        try {
          errorText = await response.text()
        } catch (e) {
          // Ignore text parsing errors
        }
        console.error('[NLP] Server error:', response.status, errorText)
        
        if (response.status === 401 || response.status === 403) {
          toast.error('Authentication required. Please log in to use AI event creation.')
        } else if (response.status >= 500) {
          toast.error('Server error. Please check the server logs for details.')
        } else {
          toast.error(`Server error: ${response.status}`)
        }
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
    if (!preview) return
    
    setLoading(true)

    try {
      // Send the edited events directly instead of re-parsing the input
      const response = await fetch('/api/events/create-from-natural-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ 
          confirm: true,
          editedEvents: preview.events,
        }),
      })

      if (!response.ok) {
        let errorText = ''
        try {
          errorText = await response.text()
        } catch (e) {
          // Ignore text parsing errors
        }
        console.error('[NLP] Server error:', response.status, errorText)
        
        if (response.status === 404) {
          toast.error('AI service not available. The backend API server is not running.')
        } else if (response.status === 401 || response.status === 403) {
          toast.error('Authentication required. Please log in to use AI event creation.')
        } else {
          toast.error(`Server error: ${response.status}`)
        }
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

            {/* Default Team and Field Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultTeam" className="text-sm flex items-center gap-2">
                  <Users size={14} />
                  Default Team
                  <span className="text-xs text-gray-400">(if not specified)</span>
                </Label>
                <Select value={defaultTeamId} onValueChange={setDefaultTeamId}>
                  <SelectTrigger id="defaultTeam">
                    <SelectValue placeholder="Select a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={String(team.id)}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultField" className="text-sm flex items-center gap-2">
                  <MapPin size={14} />
                  Default Location
                  <span className="text-xs text-gray-400">(if not specified)</span>
                </Label>
                <Select value={defaultFieldId} onValueChange={setDefaultFieldId}>
                  <SelectTrigger id="defaultField">
                    <SelectValue placeholder="Select a location..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {/* Group fields by site for better organization */}
                    {sites.map((site) => {
                      const siteFields = fields.filter(f => String(f.siteId) === String(site.id))
                      if (siteFields.length === 0) return null
                      return (
                        <div key={site.id}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
                            {site.name}
                          </div>
                          {siteFields.map((field) => (
                            <SelectItem key={field.id} value={String(field.id)}>
                              {field.name}
                            </SelectItem>
                          ))}
                        </div>
                      )
                    })}
                    {/* Show fields without sites at the end */}
                    {fields.filter(f => !f.siteId || !sites.some(s => String(s.id) === String(f.siteId))).map((field) => (
                      <SelectItem key={field.id} value={String(field.id)}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mb-2">
                <Info size={20} weight="bold" />
                <span>Review & Edit Before Creating</span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {preview.summary} — Adjust the details below if needed.
              </p>
            </div>

            {/* Editable event cards */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {preview.events.map((event, index) => (
                <div 
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Input
                      value={event.title}
                      onChange={(e) => {
                        const updated = [...preview.events]
                        updated[index] = { ...updated[index], title: e.target.value }
                        setPreview({ ...preview, events: updated })
                      }}
                      className="font-medium text-base flex-1 mr-2"
                      placeholder="Event title"
                    />
                    <Badge variant="secondary">{event.eventType}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Date */}
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1 text-gray-500">
                        <Calendar size={12} />
                        {event.isRecurring ? 'Start Date' : 'Date'}
                      </Label>
                      <Input
                        type="date"
                        value={event.date || ''}
                        onChange={(e) => {
                          const updated = [...preview.events]
                          updated[index] = { ...updated[index], date: e.target.value }
                          setPreview({ ...preview, events: updated })
                        }}
                        className="text-sm"
                      />
                    </div>

                    {/* End Date for recurring */}
                    {event.isRecurring && (
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1 text-gray-500">
                          <Calendar size={12} />
                          End Date
                        </Label>
                        <Input
                          type="date"
                          value={event.recurringEndDate || ''}
                          onChange={(e) => {
                            const updated = [...preview.events]
                            updated[index] = { ...updated[index], recurringEndDate: e.target.value }
                            setPreview({ ...preview, events: updated })
                          }}
                          className="text-sm"
                        />
                      </div>
                    )}

                    {/* Start Time */}
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1 text-gray-500">
                        <Clock size={12} />
                        Start Time
                      </Label>
                      <Input
                        type="time"
                        value={event.startTime || ''}
                        onChange={(e) => {
                          const updated = [...preview.events]
                          updated[index] = { ...updated[index], startTime: e.target.value }
                          setPreview({ ...preview, events: updated })
                        }}
                        className="text-sm"
                      />
                    </div>

                    {/* End Time */}
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1 text-gray-500">
                        <Clock size={12} />
                        End Time
                      </Label>
                      <Input
                        type="time"
                        value={event.endTime || ''}
                        onChange={(e) => {
                          const updated = [...preview.events]
                          updated[index] = { ...updated[index], endTime: e.target.value }
                          setPreview({ ...preview, events: updated })
                        }}
                        className="text-sm"
                      />
                    </div>

                    {/* Team Dropdown */}
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1 text-gray-500">
                        <Users size={12} />
                        Team
                      </Label>
                      <Select
                        value={event.teamIds.length > 0 ? String(event.teamIds[0]) : 'none'}
                        onValueChange={(value) => {
                          const updated = [...preview.events]
                          updated[index] = { 
                            ...updated[index], 
                            teamIds: value === 'none' ? [] : [parseInt(value)] 
                          }
                          setPreview({ ...preview, events: updated })
                        }}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select team..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No team</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={String(team.id)}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Venue/Field Dropdown */}
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1 text-gray-500">
                        <MapPin size={12} />
                        Venue
                      </Label>
                      <Select
                        value={event.fieldId ? String(event.fieldId) : 'none'}
                        onValueChange={(value) => {
                          const updated = [...preview.events]
                          updated[index] = { 
                            ...updated[index], 
                            fieldId: value === 'none' ? undefined : parseInt(value) 
                          }
                          setPreview({ ...preview, events: updated })
                        }}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select venue..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No venue</SelectItem>
                          {/* Group fields by site for better organization */}
                          {sites.map((site) => {
                            const siteFields = fields.filter(f => String(f.siteId) === String(site.id))
                            if (siteFields.length === 0) return null
                            return (
                              <div key={site.id}>
                                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
                                  {site.name}
                                </div>
                                {siteFields.map((field) => (
                                  <SelectItem key={field.id} value={String(field.id)}>
                                    {field.name}
                                  </SelectItem>
                                ))}
                              </div>
                            )
                          })}
                          {/* Show fields without sites at the end */}
                          {fields.filter(f => !f.siteId || !sites.some(s => String(s.id) === String(f.siteId))).map((field) => (
                            <SelectItem key={field.id} value={String(field.id)}>
                              {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {event.isRecurring && event.recurringDays && (
                    <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                      <span className="font-medium">Repeats:</span> Every {event.recurringDays.map(d => dayNames[d]).join(', ')}
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
