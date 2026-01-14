/**
 * Natural Language Event Parser
 * 
 * Uses AI to parse natural language descriptions into structured event data.
 * Supports creating single events or recurring event series.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ParsedEvent {
  title: string;
  eventType: 'Practice' | 'Game' | 'Meeting' | 'Other';
  date?: string; // ISO date for single events
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  duration?: number; // minutes
  teamNames?: string[]; // Team names to match
  siteName?: string; // Site/venue name to match
  fieldName?: string; // Field name to match
  opponent?: string; // For games
  notes?: string;
  // Recurrence info
  isRecurring: boolean;
  recurringDays?: number[]; // 1=Monday, 7=Sunday
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  excludeDates?: string[]; // Dates to skip
}

export interface ParseResult {
  success: boolean;
  events: ParsedEvent[];
  summary: string;
  rawResponse?: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an AI assistant that parses natural language event descriptions for a sports team management app. 
The app is for "Renegades," an American Football club in Oslo, Norway.

Your task is to extract structured event information from natural language input.

IMPORTANT RULES:
1. Always respond with valid JSON only - no markdown, no explanations
2. Times should be in 24-hour format (HH:mm)
3. Dates should be in ISO format (YYYY-MM-DD)
4. For recurring days, use: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday
5. Event types: "Practice", "Game", "Meeting", "Other"
6. If duration is mentioned but not end time, calculate end time
7. Default duration is 90 minutes for Practice, 180 minutes for Game, 60 minutes for Meeting
8. If no year is specified, assume 2026
9. Parse team names as they appear (e.g., "U19", "Seniors", "U15")
10. For games, extract opponent if mentioned

Return a JSON object with this structure:
{
  "success": true,
  "events": [
    {
      "title": "string - event title",
      "eventType": "Practice" | "Game" | "Meeting" | "Other",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "teamNames": ["array of team names"],
      "siteName": "venue/site name if mentioned",
      "fieldName": "specific field if mentioned",
      "opponent": "opponent name for games",
      "notes": "any additional notes",
      "isRecurring": boolean,
      "date": "YYYY-MM-DD for single events",
      "recurringDays": [1-7 array for recurring],
      "startDate": "YYYY-MM-DD for recurring series start",
      "endDate": "YYYY-MM-DD for recurring series end"
    }
  ],
  "summary": "Human-readable summary of what will be created"
}

If you cannot parse the input, return:
{
  "success": false,
  "events": [],
  "summary": "",
  "error": "Description of what's missing or unclear"
}`;

export async function parseNaturalLanguageEvent(
  input: string,
  context?: {
    teams?: { id: number; name: string }[];
    sites?: { id: number; name: string }[];
    fields?: { id: number; name: string; siteId: number }[];
    currentDate?: string;
  }
): Promise<ParseResult> {
  // Check if Anthropic API key is available
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    // Fallback to basic regex parsing if no API key
    return parseWithRegex(input);
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    // Build context string for the AI
    let contextStr = '';
    if (context?.teams?.length) {
      contextStr += `\nAvailable teams: ${context.teams.map(t => t.name).join(', ')}`;
    }
    if (context?.sites?.length) {
      contextStr += `\nAvailable sites: ${context.sites.map(s => s.name).join(', ')}`;
    }
    if (context?.currentDate) {
      contextStr += `\nCurrent date: ${context.currentDate}`;
    }

    const userMessage = contextStr 
      ? `Context:${contextStr}\n\nParse this event description:\n"${input}"`
      : `Parse this event description:\n"${input}"`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const parsed = JSON.parse(content.text) as ParseResult;
    parsed.rawResponse = content.text;
    
    return parsed;
  } catch (error) {
    console.error('[EventParser] AI parsing failed:', error);
    
    // Fallback to regex parsing
    return parseWithRegex(input);
  }
}

/**
 * Fallback regex-based parser for when AI is unavailable
 */
function parseWithRegex(input: string): ParseResult {
  const lowerInput = input.toLowerCase();
  
  try {
    // Detect event type
    let eventType: ParsedEvent['eventType'] = 'Other';
    if (/practice|training|trening/.test(lowerInput)) {
      eventType = 'Practice';
    } else if (/game|match|kamp/.test(lowerInput)) {
      eventType = 'Game';
    } else if (/meeting|møte/.test(lowerInput)) {
      eventType = 'Meeting';
    }

    // Extract time (various formats)
    let startTime = '18:00'; // default
    let endTime = '20:00';
    
    const timeMatch = lowerInput.match(/(\d{1,2})[:\.]?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] || '00';
      const ampm = timeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      startTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
      
      // Calculate end time based on event type
      const durationMins = eventType === 'Game' ? 180 : eventType === 'Meeting' ? 60 : 90;
      const endHours = Math.floor((hours * 60 + parseInt(minutes) + durationMins) / 60) % 24;
      const endMins = (parseInt(minutes) + durationMins) % 60;
      endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    }

    // Extract recurring days
    const dayMap: Record<string, number> = {
      'monday': 1, 'mandag': 1,
      'tuesday': 2, 'tirsdag': 2,
      'wednesday': 3, 'onsdag': 3,
      'thursday': 4, 'torsdag': 4,
      'friday': 5, 'fredag': 5,
      'saturday': 6, 'lørdag': 6,
      'sunday': 7, 'søndag': 7,
    };
    
    const recurringDays: number[] = [];
    for (const [day, num] of Object.entries(dayMap)) {
      if (lowerInput.includes(day)) {
        recurringDays.push(num);
      }
    }

    // Check for recurring keywords
    const isRecurring = /every|each|weekly|ukentlig|hver/.test(lowerInput) && recurringDays.length > 0;

    // Extract team names (common patterns)
    const teamNames: string[] = [];
    const teamPatterns = [
      /u-?(\d+)/gi, // U19, U-15, etc.
      /seniors?/gi,
      /juniors?/gi,
    ];
    for (const pattern of teamPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        teamNames.push(...matches.map(m => m.replace('-', '')));
      }
    }

    // Extract dates
    const now = new Date();
    let startDate = now.toISOString().split('T')[0];
    let endDate: string | undefined;

    // Look for date ranges like "January 20 to March 30"
    const dateRangeMatch = input.match(
      /(?:from\s+)?(\w+\s+\d{1,2})(?:\s+to\s+|\s*-\s*)(\w+\s+\d{1,2})/i
    );
    if (dateRangeMatch) {
      startDate = parseSimpleDate(dateRangeMatch[1]) || startDate;
      endDate = parseSimpleDate(dateRangeMatch[2]);
    }

    // Generate title
    let title = eventType;
    if (teamNames.length > 0) {
      title = `${teamNames[0]} ${eventType}`;
    }

    const events: ParsedEvent[] = [{
      title,
      eventType,
      startTime,
      endTime,
      teamNames: teamNames.length > 0 ? teamNames : undefined,
      isRecurring,
      ...(isRecurring ? {
        recurringDays,
        startDate,
        endDate,
      } : {
        date: startDate,
      }),
    }];

    // Build summary
    let summary = `Creating ${isRecurring ? 'recurring ' : ''}${eventType.toLowerCase()}`;
    if (teamNames.length > 0) {
      summary += ` for ${teamNames.join(', ')}`;
    }
    if (isRecurring && recurringDays.length > 0) {
      const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      summary += ` every ${recurringDays.map(d => dayNames[d]).join(' and ')}`;
    }
    summary += ` at ${startTime}`;

    return {
      success: true,
      events,
      summary,
    };
  } catch (error) {
    return {
      success: false,
      events: [],
      summary: '',
      error: `Could not parse input: ${(error as Error).message}`,
    };
  }
}

/**
 * Parse simple date strings like "January 20" or "March 30"
 */
function parseSimpleDate(dateStr: string): string | undefined {
  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const match = dateStr.toLowerCase().match(/(\w+)\s+(\d{1,2})/);
  if (match) {
    const month = months[match[1]];
    const day = parseInt(match[2]);
    if (month !== undefined && day) {
      const year = new Date().getFullYear();
      // If the date is in the past, use next year
      const date = new Date(year, month, day);
      if (date < new Date()) {
        date.setFullYear(year + 1);
      }
      return date.toISOString().split('T')[0];
    }
  }
  return undefined;
}

/**
 * Convert parsed events to the format expected by the events API
 */
export function convertToApiEvents(
  parsed: ParsedEvent[],
  mapping: {
    teams: Map<string, number>;
    sites: Map<string, number>;
    fields: Map<string, { id: number; siteId: number }>;
  }
): Array<{
  title: string;
  eventType: string;
  date: string;
  startTime: string;
  endTime: string;
  teamIds: number[];
  fieldId?: number;
  otherParticipants?: string;
  notes?: string;
  isRecurring: boolean;
  recurringDays?: number[];
  recurringEndDate?: string;
}> {
  const results: any[] = [];

  for (const event of parsed) {
    // Map team names to IDs
    const teamIds: number[] = [];
    if (event.teamNames) {
      for (const name of event.teamNames) {
        // Try exact match first, then partial
        const normalizedName = name.toLowerCase();
        for (const [teamName, teamId] of mapping.teams) {
          if (teamName.toLowerCase().includes(normalizedName) || 
              normalizedName.includes(teamName.toLowerCase())) {
            teamIds.push(teamId);
            break;
          }
        }
      }
    }

    // Map field/site names
    let fieldId: number | undefined;
    if (event.fieldName) {
      const normalizedField = event.fieldName.toLowerCase();
      for (const [fieldName, field] of mapping.fields) {
        if (fieldName.toLowerCase().includes(normalizedField)) {
          fieldId = field.id;
          break;
        }
      }
    }

    if (event.isRecurring) {
      results.push({
        title: event.title,
        eventType: event.eventType,
        date: event.startDate!,
        startTime: event.startTime,
        endTime: event.endTime,
        teamIds,
        fieldId,
        otherParticipants: event.opponent,
        notes: event.notes,
        isRecurring: true,
        recurringDays: event.recurringDays,
        recurringEndDate: event.endDate,
      });
    } else {
      results.push({
        title: event.title,
        eventType: event.eventType,
        date: event.date!,
        startTime: event.startTime,
        endTime: event.endTime,
        teamIds,
        fieldId,
        otherParticipants: event.opponent,
        notes: event.notes,
        isRecurring: false,
      });
    }
  }

  return results;
}
