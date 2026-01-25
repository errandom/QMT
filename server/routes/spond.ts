/**
 * Spond API Client for Node.js/TypeScript
 * 
 * Based on the Spond REST API (unofficial)
 * API Base URL: https://api.spond.com/core/v1/
 * 
 * Spond is a sports team management platform. This client allows
 * syncing events, groups (teams), and members with the Renegades app.
 */

interface SpondLoginResponse {
  loginToken: string;
  [key: string]: any;
}

interface SpondMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  profile?: {
    id: string;
  };
  role?: string;
  guardians?: SpondMember[];
}

interface SpondSubgroup {
  id: string;
  name: string;
  members?: string[];
}

export interface SpondGroup {
  id: string;
  name: string;
  description?: string;
  activity?: string;
  createdTime?: string;
  members: SpondMember[];
  subGroups?: SpondSubgroup[];
  settings?: {
    [key: string]: any;
  };
}

export interface SpondEventResponse {
  accepted?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    respondedTime?: string;
  }>;
  declined?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    respondedTime?: string;
  }>;
  unanswered?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
  waiting?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
  unconfirmed?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
}

export interface SpondAttendance {
  accepted: SpondMember[];
  declined: SpondMember[];
  unanswered: SpondMember[];
  waiting: SpondMember[];
  unconfirmed: SpondMember[];
  counts: {
    accepted: number;
    declined: number;
    unanswered: number;
    waiting: number;
    unconfirmed: number;
    total: number;
  };
}

export interface SpondEvent {
  id: string;
  heading: string;
  description?: string;
  spilesType?: string;
  type?: string;
  startTimestamp: string;
  endTimestamp: string;
  cancelled?: boolean;
  hidden?: boolean;
  inviteTime?: string;
  rsvpDate?: string;
  location?: {
    id?: string;
    feature?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  owners?: SpondMember[];
  responses?: SpondEventResponse;
  recipients?: {
    group?: {
      id: string;
      name?: string;
    };
    subGroups?: Array<{
      id: string;
      name?: string;
    }>;
  };
  tasks?: any[];
  comments?: any[];
  autoAccept?: boolean;
  autoReminderType?: string;
  matchInfo?: {
    homeTeam?: string;
    awayTeam?: string;
    homeScore?: number;
    awayScore?: number;
  };
}

export interface SpondConfig {
  username: string;
  password: string;
}

export class SpondClient {
  private readonly API_BASE_URL = 'https://api.spond.com/core/v1/';
  private readonly DT_FORMAT = 'yyyy-MM-dd\'T\'00:00:00.000\'Z\'';
  
  private username: string;
  private password: string;
  private token: string | null = null;
  private chatUrl: string | null = null;
  private chatAuth: string | null = null;
  
  private groups: SpondGroup[] | null = null;
  private events: SpondEvent[] | null = null;

  constructor(config: SpondConfig) {
    this.username = config.username;
    this.password = config.password;
  }

  private get authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    };
  }

  /**
   * Authenticate with Spond API
   */
  async login(): Promise<void> {
    const loginUrl = `${this.API_BASE_URL}login`;
    console.log('[Spond] Attempting login for:', this.username);
    
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: this.username,
          password: this.password,
        }),
      });

      console.log('[Spond] Login response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Spond] Login error response:', errorText);
        
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid email or password. Please check your Spond credentials.');
        } else if (response.status === 429) {
          throw new Error('Too many login attempts. Please wait a few minutes and try again.');
        } else {
          throw new Error(`Spond login failed (${response.status}): ${response.statusText}`);
        }
      }

      const result = await response.json() as SpondLoginResponse;
      console.log('[Spond] Login response keys:', Object.keys(result));
      
      this.token = result.loginToken;

      if (!this.token) {
        console.error('[Spond] No token in response:', JSON.stringify(result).substring(0, 200));
        throw new Error('Spond login failed: No authentication token received. The API response format may have changed.');
      }

      console.log('[Spond] Successfully authenticated');
    } catch (error) {
      if (error instanceof TypeError && (error as any).cause?.code === 'ENOTFOUND') {
        throw new Error('Cannot reach Spond servers. Please check your internet connection.');
      }
      throw error;
    }
  }

  /**
   * Ensure we're authenticated before making API calls
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.token) {
      await this.login();
    }
  }

  /**
   * Get all groups the authenticated user has access to
   */
  async getGroups(): Promise<SpondGroup[]> {
    await this.ensureAuthenticated();

    // Include members in the response to get member counts
    const url = `${this.API_BASE_URL}groups/?includeMembers=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch groups: ${response.status} ${response.statusText}`);
    }

    this.groups = await response.json() as SpondGroup[];
    console.log(`[Spond] Retrieved ${this.groups?.length || 0} groups`);
    
    // Log member counts for debugging
    for (const group of this.groups || []) {
      console.log(`[Spond] Group "${group.name}": ${group.members?.length || 0} members, ${group.subGroups?.length || 0} subgroups`);
      for (const subgroup of group.subGroups || []) {
        console.log(`[Spond]   Subgroup "${subgroup.name}": ${subgroup.members?.length || 0} member IDs`);
      }
    }
    
    return this.groups || [];
  }

  /**
   * Get a specific group by ID
   */
  async getGroup(groupId: string): Promise<SpondGroup | null> {
    if (!this.groups) {
      await this.getGroups();
    }
    
    return this.groups?.find(g => g.id === groupId) || null;
  }

  /**
   * Get events with optional filtering
   */
  async getEvents(options: {
    groupId?: string;
    subgroupId?: string;
    includeScheduled?: boolean;
    includeHidden?: boolean;
    maxEnd?: Date;
    minEnd?: Date;
    maxStart?: Date;
    minStart?: Date;
    maxEvents?: number;
  } = {}): Promise<SpondEvent[]> {
    await this.ensureAuthenticated();

    const params = new URLSearchParams();
    
    if (options.groupId) {
      params.append('GroupId', options.groupId);
    }
    if (options.subgroupId) {
      params.append('subgroupId', options.subgroupId);
    }
    if (options.includeScheduled) {
      params.append('scheduled', 'true');
    }
    if (options.includeHidden) {
      params.append('includeHidden', 'true');
    }
    if (options.maxEnd) {
      params.append('maxEndTimestamp', options.maxEnd.toISOString());
    }
    if (options.minEnd) {
      params.append('minEndTimestamp', options.minEnd.toISOString());
    }
    if (options.maxStart) {
      params.append('maxStartTimestamp', options.maxStart.toISOString());
    }
    if (options.minStart) {
      params.append('minStartTimestamp', options.minStart.toISOString());
    }
    if (options.maxEvents) {
      params.append('max', options.maxEvents.toString());
    } else {
      params.append('max', '100'); // Default limit
    }

    const url = `${this.API_BASE_URL}sppiond?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
    }

    this.events = await response.json() as SpondEvent[];
    console.log(`[Spond] Retrieved ${this.events?.length || 0} events`);
    return this.events || [];
  }

  /**
   * Get a specific event by ID
   */
  async getEvent(eventId: string): Promise<SpondEvent | null> {
    await this.ensureAuthenticated();

    const url = `${this.API_BASE_URL}sppionds/${eventId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch event: ${response.status} ${response.statusText}`);
    }

    return await response.json() as SpondEvent;
  }

  /**
   * Create a new event in Spond
   */
  async createEvent(groupId: string, event: {
    heading: string;
    description?: string;
    startTimestamp: Date;
    endTimestamp: Date;
    location?: {
      address?: string;
      latitude?: number;
      longitude?: number;
    };
    type?: 'EVENT' | 'RECURRING' | 'MATCH';
    subgroupIds?: string[];
    autoAccept?: boolean;
    inviteTime?: Date;
  }): Promise<SpondEvent> {
    await this.ensureAuthenticated();

    const url = `${this.API_BASE_URL}sppionds`;
    
    const payload = {
      heading: event.heading,
      description: event.description || '',
      spilesType: event.type || 'EVENT',
      startTimestamp: event.startTimestamp.toISOString(),
      endTimestamp: event.endTimestamp.toISOString(),
      recipients: {
        group: { id: groupId },
        ...(event.subgroupIds && event.subgroupIds.length > 0 ? {
          subGroups: event.subgroupIds.map(id => ({ id }))
        } : {})
      },
      ...(event.location && {
        location: {
          address: event.location.address,
          latitude: event.location.latitude,
          longitude: event.location.longitude,
        }
      }),
      autoAccept: event.autoAccept ?? false,
      ...(event.inviteTime && {
        inviteTime: event.inviteTime.toISOString()
      }),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create event: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const createdEvent = await response.json() as SpondEvent;
    console.log(`[Spond] Created event: ${createdEvent.id}`);
    return createdEvent;
  }

  /**
   * Update an existing event in Spond
   */
  async updateEvent(eventId: string, updates: Partial<{
    heading: string;
    description: string;
    startTimestamp: Date;
    endTimestamp: Date;
    cancelled: boolean;
    location: {
      address?: string;
      latitude?: number;
      longitude?: number;
    };
  }>): Promise<SpondEvent> {
    await this.ensureAuthenticated();

    const url = `${this.API_BASE_URL}sppionds/${eventId}`;
    
    const payload: any = {};
    
    if (updates.heading !== undefined) payload.heading = updates.heading;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.startTimestamp !== undefined) payload.startTimestamp = updates.startTimestamp.toISOString();
    if (updates.endTimestamp !== undefined) payload.endTimestamp = updates.endTimestamp.toISOString();
    if (updates.cancelled !== undefined) payload.cancelled = updates.cancelled;
    if (updates.location !== undefined) payload.location = updates.location;

    const response = await fetch(url, {
      method: 'POST', // Spond uses POST for updates
      headers: this.authHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update event: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const updatedEvent = await response.json() as SpondEvent;
    console.log(`[Spond] Updated event: ${eventId}`);
    return updatedEvent;
  }

  /**
   * Delete (cancel) an event in Spond
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.ensureAuthenticated();

    const url = `${this.API_BASE_URL}sppionds/${eventId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.authHeaders,
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete event: ${response.status} ${response.statusText}`);
    }

    console.log(`[Spond] Deleted event: ${eventId}`);
  }

  /**
   * Get members from a specific group
   */
  async getGroupMembers(groupId: string): Promise<SpondMember[]> {
    const group = await this.getGroup(groupId);
    return group?.members || [];
  }

  /**
   * Find a person by various identifiers
   */
  async getPerson(identifier: string): Promise<SpondMember | null> {
    if (!this.groups) {
      await this.getGroups();
    }

    for (const group of this.groups || []) {
      for (const member of group.members) {
        if (this.matchPerson(member, identifier)) {
          return member;
        }
        if (member.guardians) {
          for (const guardian of member.guardians) {
            if (this.matchPerson(guardian, identifier)) {
              return guardian;
            }
          }
        }
      }
    }

    return null;
  }

  private matchPerson(person: SpondMember, matchStr: string): boolean {
    return Boolean(
      person.id === matchStr ||
      (person.email && person.email === matchStr) ||
      `${person.firstName} ${person.lastName}` === matchStr ||
      (person.profile && person.profile.id === matchStr)
    );
  }

  /**
   * Get detailed event with full attendance/response data
   */
  async getEventWithAttendance(eventId: string): Promise<SpondEvent | null> {
    await this.ensureAuthenticated();

    // The event endpoint returns responses when fetching a single event
    const url = `${this.API_BASE_URL}sppionds/${eventId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch event: ${response.status} ${response.statusText}`);
    }

    return await response.json() as SpondEvent;
  }

  /**
   * Get event attendance/responses with member details
   */
  async getEventAttendance(eventId: string): Promise<SpondAttendance> {
    const event = await this.getEventWithAttendance(eventId);
    
    const emptyResult: SpondAttendance = {
      accepted: [],
      declined: [],
      unanswered: [],
      waiting: [],
      unconfirmed: [],
      counts: { accepted: 0, declined: 0, unanswered: 0, waiting: 0, unconfirmed: 0, total: 0 }
    };

    if (!event) {
      return emptyResult;
    }

    // Get the group to cross-reference member details
    const groupId = event.recipients?.group?.id;
    let groupMembers: Map<string, SpondMember> = new Map();
    
    if (groupId) {
      const group = await this.getGroup(groupId);
      if (group?.members) {
        group.members.forEach(m => groupMembers.set(m.id, m));
      }
    }

    // Helper to enrich response with member details
    const enrichResponses = (responses: any[] | undefined): SpondMember[] => {
      if (!responses || !Array.isArray(responses)) return [];
      return responses.map(r => {
        const member = groupMembers.get(r.id);
        return {
          id: r.id,
          firstName: r.firstName || member?.firstName || 'Unknown',
          lastName: r.lastName || member?.lastName || '',
          email: r.email || member?.email,
          phoneNumber: member?.phoneNumber,
        };
      });
    };

    const accepted = enrichResponses(event.responses?.accepted);
    const declined = enrichResponses(event.responses?.declined);
    const unanswered = enrichResponses(event.responses?.unanswered);
    const waiting = enrichResponses(event.responses?.waiting);
    const unconfirmed = enrichResponses(event.responses?.unconfirmed);

    return {
      accepted,
      declined,
      unanswered,
      waiting,
      unconfirmed,
      counts: {
        accepted: accepted.length,
        declined: declined.length,
        unanswered: unanswered.length,
        waiting: waiting.length,
        unconfirmed: unconfirmed.length,
        total: accepted.length + declined.length + unanswered.length + waiting.length + unconfirmed.length
      }
    };
  }

  /**
   * Get event attendance/responses (legacy method for compatibility)
   */
  async getEventResponses(eventId: string): Promise<{
    accepted: SpondMember[];
    declined: SpondMember[];
    unanswered: SpondMember[];
    waiting: SpondMember[];
  }> {
    const attendance = await this.getEventAttendance(eventId);
    return {
      accepted: attendance.accepted,
      declined: attendance.declined,
      unanswered: attendance.unanswered,
      waiting: attendance.waiting,
    };
  }

  /**
   * Test connection to Spond
   */
  async testConnection(): Promise<{ success: boolean; message: string; groupCount?: number }> {
    try {
      await this.login();
      const groups = await this.getGroups();
      return {
        success: true,
        message: `Connected successfully. Found ${groups.length} group(s).`,
        groupCount: groups.length,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${(error as Error).message}`,
      };
    }
  }
}

// Singleton instance for reuse
let spondClient: SpondClient | null = null;

export function getSpondClient(): SpondClient | null {
  return spondClient;
}

export function initializeSpondClient(config: SpondConfig): SpondClient {
  spondClient = new SpondClient(config);
  return spondClient;
}

export function clearSpondClient(): void {
  spondClient = null;
}
