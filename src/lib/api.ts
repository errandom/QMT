// API Configuration Module
// Used by frontend to get the correct API base URL
import type { Event, FacilityRequest, EquipmentRequest, CancellationRequest, UserRole, PublishedSchedule, BookingConflict } from './types';
export type StoredRequest = (FacilityRequest & { type: 'facility' })
  | (EquipmentRequest & { type: 'equipment' }) | (CancellationRequest & { type: 'cancellation' });

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export default API_BASE_URL;

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Auth state management
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): any | null {
  const user = localStorage.getItem(USER_KEY);
  if (!user) return null;
  try { return JSON.parse(user); }
  catch {
    console.warn('Stored session could not be read; sign in again.');
    removeToken();
    return null;
  }
}

export function setStoredUser(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Data transformation utilities to convert between database snake_case and frontend camelCase
function transformTeam(team: any): any {
  if (!team) return team;
  
  // Build headCoach object from database fields
  const headCoach = (team.head_coach_first_name || team.head_coach_last_name || team.head_coach_email || team.head_coach_phone) ? {
    firstName: team.head_coach_first_name || '',
    lastName: team.head_coach_last_name || '',
    email: team.head_coach_email || '',
    phone: team.head_coach_phone || ''
  } : undefined;
  
  // Build teamManager object from database fields
  const teamManager = (team.team_manager_first_name || team.team_manager_last_name || team.team_manager_email || team.team_manager_phone) ? {
    firstName: team.team_manager_first_name || '',
    lastName: team.team_manager_last_name || '',
    email: team.team_manager_email || '',
    phone: team.team_manager_phone || ''
  } : undefined;
  
  return {
    id: String(team.id || ''),
    name: team.name || '',
    sportType: team.sport || team.sportType || 'Tackle Football',
    isActive: team.isActive !== undefined ? Boolean(team.isActive) : (team.active !== undefined ? Boolean(team.active) : true),
    headCoach,
    teamManager,
    rosterSize: team.age_group || team.rosterSize
  };
}

function transformSite(site: any): any {
  if (!site) return site;
  
  // Parse amenities if it's a JSON string
  let amenities = site.amenities;
  if (typeof amenities === 'string') {
    try {
      amenities = JSON.parse(amenities);
    } catch (e) {
      // If parsing fails, use default amenities
      amenities = {
        parking: false,
        toilets: false,
        lockerRooms: false,
        shower: false,
        restaurant: false,
        equipmentStash: false
      };
    }
  }
  
  // Ensure amenities has all required fields
  if (!amenities || typeof amenities !== 'object') {
    amenities = {
      parking: false,
      toilets: false,
      lockerRooms: false,
      shower: false,
      restaurant: false,
      equipmentStash: false
    };
  }
  
  return {
    id: String(site.id || ''),
    name: site.name || '',
    address: site.address || '',
    city: site.city || '',
    zipCode: site.zipCode || site.zip_code || '',
    latitude: site.latitude || 0,
    longitude: site.longitude || 0,
    contactFirstName: site.contactFirstName || site.contact_first_name || '',
    contactLastName: site.contactLastName || site.contact_last_name || '',
    contactPhone: site.contactPhone || site.contact_phone || '',
    contactEmail: site.contactEmail || site.contact_email || '',
    publishedScheduleUrl: site.publishedScheduleUrl || site.published_schedule_url || '',
    publishedBookingName: site.publishedBookingName || site.published_booking_name || '',
    isSportsFacility: site.isSportsFacility !== undefined ? Boolean(site.isSportsFacility) : (site.is_sports_facility !== undefined ? Boolean(site.is_sports_facility) : true),
    isActive: site.isActive !== undefined ? Boolean(site.isActive) : (site.active !== undefined ? Boolean(site.active) : true),
    amenities
  };
}

function transformField(field: any): any {
  if (!field) return field;
  // Handle id properly - preserve numeric 0 as "0", not empty string
  const fieldId = field.id !== undefined && field.id !== null ? String(field.id) : '';
  const siteId = field.siteId !== undefined && field.siteId !== null 
    ? String(field.siteId) 
    : (field.site_id !== undefined && field.site_id !== null ? String(field.site_id) : '');
  return {
    ...field,
    id: fieldId,
    siteId: siteId,
    locationType: field.locationType || field.location_type || 'field',
    turfType: field.turfType || field.field_type || 'Natural Turf',
    hasLights: field.hasLights !== undefined ? Boolean(field.hasLights) : (field.has_lights !== undefined ? Boolean(field.has_lights) : false),
    fieldSize: field.fieldSize || field.surface_type || 'Full',
    isActive: field.isActive !== undefined ? Boolean(field.isActive) : (field.active !== undefined ? Boolean(field.active) : true)
  };
}

function transformEquipment(equipment: any): any {
  if (!equipment) return equipment;
  return {
    ...equipment,
    id: String(equipment.id || ''),
    isActive: equipment.isActive !== undefined ? Boolean(equipment.isActive) : (equipment.active !== undefined ? Boolean(equipment.active) : true)
  };
}

function transformEvent(event: any): any {
  if (!event) return event;
  
  
  // Parse start_time and end_time from database datetime format
  const startDateTime = new Date(event.start_time || event.startTime);
  const endDateTime = new Date(event.end_time || event.endTime);
  
  // Handle invalid dates gracefully
  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    console.error('[API] Invalid date in event:', event);
    // Return event with default values to prevent crashes
    return {
      id: String(event.id || ''),
      title: event.title || event.description || 'Untitled Event',
      eventType: event.eventType || event.event_type || 'Other',
      status: event.status || 'Planned',
      date: '',
      startTime: '',
      endTime: '',
      teamIds: [],
      fieldIds: [],
      isRecurring: false,
      notes: event.notes || '',
    };
  }
  
  // Extract date in YYYY-MM-DD format using UTC
  const date = startDateTime.toISOString().split('T')[0];
  const endDate = endDateTime.toISOString().split('T')[0];
  
  // Extract times in HH:MM format using UTC to avoid timezone shifts
  const startHours = String(startDateTime.getUTCHours()).padStart(2, '0');
  const startMinutes = String(startDateTime.getUTCMinutes()).padStart(2, '0');
  const startTime = `${startHours}:${startMinutes}`;
  
  const endHours = String(endDateTime.getUTCHours()).padStart(2, '0');
  const endMinutes = String(endDateTime.getUTCMinutes()).padStart(2, '0');
  const endTime = `${endHours}:${endMinutes}`;
  
  // Convert team_ids string (comma-separated) to array, or fallback to single team_id
  let teamIds: string[] = [];
  if (event.team_ids) {
    // team_ids is stored as comma-separated string like "1,2,3"
    teamIds = event.team_ids.split(',').map((id: string) => id.trim()).filter(Boolean);
  } else if (event.team_id) {
    // Fallback to single team_id
    teamIds = [String(event.team_id)];
  } else if (event.teamIds) {
    teamIds = event.teamIds;
  }
  
  // Convert recurring_days string to number array
  let recurringDays: number[] | undefined = undefined;
  if (event.recurring_days) {
    recurringDays = event.recurring_days.split(',').map((day: string) => parseInt(day.trim())).filter((day: number) => !isNaN(day));
  } else if (event.recurringDays) {
    recurringDays = event.recurringDays;
  }
  
  // Determine if event is recurring
  const isRecurring = Boolean(recurringDays && recurringDays.length > 0);
  
  
  // Format recurring_end_date to YYYY-MM-DD if it exists
  let recurringEndDate = event.recurring_end_date || event.recurringEndDate;
  if (recurringEndDate && recurringEndDate instanceof Date) {
    recurringEndDate = recurringEndDate.toISOString().split('T')[0];
  } else if (recurringEndDate && typeof recurringEndDate === 'string' && recurringEndDate.includes('T')) {
    recurringEndDate = recurringEndDate.split('T')[0];
  }
  
  // Convert field_ids string (comma-separated) to array, or fallback to single field_id
  let fieldIds: string[] = [];
  if (event.field_ids) {
    // field_ids is stored as comma-separated string like "1,2,3"
    fieldIds = event.field_ids.split(',').map((id: string) => id.trim()).filter(Boolean);
  } else if (event.field_id) {
    // Fallback to single field_id for backward compatibility
    fieldIds = [String(event.field_id)];
  } else if (event.fieldIds) {
    fieldIds = event.fieldIds;
  }
  
  const transformed = {
    id: String(event.id || ''),
    title: event.title || event.description || `${event.event_type || event.eventType} Event`,
    eventType: event.eventType || event.event_type || 'Other',
    status: event.status || 'Planned',
    date,
    endDate,
    startTime,
    endTime,
    teamIds,
    fieldIds,
    isRecurring,
    recurringDays,
    recurringEndDate,
    notes: event.notes || '',
    estimatedAttendance: event.estimatedAttendance || event.estimated_attendance,
    otherParticipants: event.otherParticipants || event.other_participants,
    // Game location fields
    gameLocation: event.gameLocation || event.game_location || undefined,
    awayStreet: event.awayStreet || event.away_street || '',
    awayZip: event.awayZip || event.away_zip || '',
    awayCity: event.awayCity || event.away_city || '',
    transportRequested: Boolean(event.transportRequested ?? event.transport_requested ?? false),
    // Spond integration fields
    spondId: event.spondId || event.spond_id || undefined,
    spondGroupId: event.spondGroupId || event.spond_group_id || undefined,
  };
  
  return transformed;
}

export class ApiError extends Error {
  bookingConflict?: { conflicts: BookingConflict[]; hasMoreConflicts: boolean };
  conflictingEvent?: unknown;
  conflictedDates?: unknown;
  constructor(message: string, public readonly status: number) { super(message); }
}

function isBookingConflict(value: unknown): value is BookingConflict {
  if (!value || typeof value !== 'object') return false;
  const strings = ['title', 'eventType', 'status', 'startTime', 'endTime', 'requestedStartTime', 'requestedEndTime'];
  return 'eventId' in value && Number.isSafeInteger(value.eventId)
    && strings.every(key => key in value && typeof Reflect.get(value, key) === 'string')
    && ['startTime', 'endTime', 'requestedStartTime', 'requestedEndTime']
      .every(key => Number.isFinite(Date.parse(Reflect.get(value, key))))
    && 'fields' in value && Array.isArray(value.fields) && value.fields.length > 0
    && value.fields.every(field => field && Number.isSafeInteger(field.id)
      && typeof field.name === 'string' && typeof field.siteName === 'string')
    && 'teams' in value && Array.isArray(value.teams)
    && value.teams.every(team => team && Number.isSafeInteger(team.id) && typeof team.name === 'string');
}

// Helper function to make API calls
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  
  const headers = new Headers(options?.headers);
  if (options?.body) headers.set('Content-Type', 'application/json');

  // Add authentication token if available
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', ['Bearer', token].join(' '));
  }
  
  const response = await fetch(url, {
    ...options,
    signal: options?.signal || AbortSignal.timeout(15000),
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid - clear auth state
      removeToken();
    }
    
    // Try to parse JSON error, fallback to text
    let errorMessage = `HTTP ${response.status}`;
    let errorData: any = null;
    
    try {
      const error = await response.json();
      errorData = error;
      errorMessage = error.error || error.message || errorMessage;
    } catch (e) {
      // Not JSON, try to get text
      try {
        const text = await response.text();
        // Check if it's HTML
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          console.error(`[API] ❌ Server returned HTML instead of JSON for ${url}`);
          console.error('[API] Response preview:', text.substring(0, 200));
          errorMessage = 'Server error: Expected JSON but received HTML. Check server logs.';
        } else {
          errorMessage = text || errorMessage;
        }
      } catch (e2) {
        // Can't get any response body
      }
    }
    
    console.error(`[API] ❌ Error on ${url}:`, errorMessage);
    
    // Create error with status and data for better handling
    const apiError = new ApiError(errorMessage, response.status);
    if (errorData) {
      apiError.conflictingEvent = errorData.conflictingEvent;
      apiError.conflictedDates = errorData.conflictedDates;
      if (response.status === 409 && errorData.code === 'BOOKING_CONFLICT'
          && Array.isArray(errorData.conflicts) && errorData.conflicts.length > 0
          && errorData.conflicts.every(isBookingConflict) && typeof errorData.hasMoreConflicts === 'boolean') {
        apiError.bookingConflict = { conflicts: errorData.conflicts, hasMoreConflicts: errorData.hasMoreConflicts };
      }
    }
    throw apiError;
  }

  // Handle 204 No Content responses (e.g., DELETE operations)
  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();
  return data;
}

// Example API functions
export const api = {
  // Auth
  login: (username: string, password: string) => 
    apiRequest<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (data: { username: string; password: string; role: string; email?: string; fullName?: string }) =>
    apiRequest<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCurrentUser: () => apiRequest<{
    id: number; username: string; role: UserRole; is_active: boolean;
    email?: string; full_name?: string;
  }>('/auth/me'),
  getUsers: () => apiRequest<any[]>('/auth/users'),
  updateUser: (id: number, data: { username: string; role: string; email?: string; fullName?: string; isActive?: boolean }) =>
    apiRequest<any>(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteUser: (id: number) =>
    apiRequest<void>(`/auth/users/${id}`, {
      method: 'DELETE',
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<any>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Events
  getEvents: async (range?: { from: string; to: string }) => {
    const now = Date.now();
    const window = range || {
      from: new Date(now - 7 * 86400000).toISOString(),
      to: new Date(now + 90 * 86400000).toISOString(),
    };
    const query = new URLSearchParams({ limit: '500', ...window });
    const events: Event[] = [];
    let after = 0;
    for (let page = 0; page < 20; page++) {
      query.set('after', String(after));
      const batch = await apiRequest<any[]>(`/events?${query}`);
      if (!Array.isArray(batch)) throw new Error('Invalid events response');
      events.push(...batch.map(transformEvent));
      if (batch.length < 500) return events;
      const next = Number(batch[batch.length - 1].id);
      if (!Number.isSafeInteger(next) || next <= after) throw new Error('Invalid event pagination cursor');
      after = next;
    }
    throw new Error('Too many events in this range; select a shorter interval');
  },
  getEvent: (id: number) => apiRequest<any>(`/events/${id}`),
  createEvent: async (data: any) => {
    try {
      const result = await apiRequest<any>('/events', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      // Handle both single event and array of events (for recurring)
      if (Array.isArray(result)) {
        return result.map(transformEvent);
      }
      return transformEvent(result);
    } catch (error) {
      console.error('[API] Error creating event:', error);
      throw error;
    }
  },
  updateEvent: async (id: number, data: any) => {
    try {
      const result = await apiRequest<any>(`/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      
      // Handle both single event and array of events (when converting to recurring)
      if (Array.isArray(result)) {
        return result.map(transformEvent);
      }
      return transformEvent(result);
    } catch (error) {
      console.error('[API] Error updating event:', error);
      throw error;
    }
  },
  deleteEvent: (id: number) => apiRequest<any>(`/events/${id}`, {
    method: 'DELETE',
  }),

  // Teams
  getTeams: async () => {
    const teams = await apiRequest<any[]>('/teams');
    if (!Array.isArray(teams)) throw new Error('Invalid teams response');
    return teams.map(transformTeam);
  },
  getTeam: (id: number) => apiRequest<any>(`/teams/${id}`),
  createTeam: (data: any) => apiRequest<any>('/teams', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTeam: (id: number, data: any) => apiRequest<any>(`/teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteTeam: (id: number) => apiRequest<any>(`/teams/${id}`, {
    method: 'DELETE',
  }),

  // Sites
  getSites: async () => {
    const sites = await apiRequest<any[]>('/sites');
    if (!Array.isArray(sites)) throw new Error('Invalid sites response');
    return sites.map(transformSite);
  },
  getSite: (id: number) => apiRequest<any>(`/sites/${id}`).then(transformSite),
  getPublishedSchedule: (id: string, date: string) =>
    apiRequest<PublishedSchedule>(`/sites/${encodeURIComponent(id)}/published-schedule?date=${encodeURIComponent(date)}`),
  createSite: async (data: any) => {
    const response = await apiRequest<any>('/sites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return transformSite(response);
  },
  updateSite: async (id: number, data: any) => {
    const response = await apiRequest<any>(`/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return transformSite(response);
  },
  deleteSite: (id: number) => apiRequest<any>(`/sites/${id}`, {
    method: 'DELETE',
  }),

  // Fields
  getFields: async () => {
    const fields = await apiRequest<any[]>('/fields');
    if (!Array.isArray(fields)) throw new Error('Invalid fields response');
    return fields.map(transformField);
  },
  getField: (id: number) => apiRequest<any>(`/fields/${id}`),
  createField: (data: any) => apiRequest<any>('/fields', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateField: (id: number, data: any) => apiRequest<any>(`/fields/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteField: (id: number) => apiRequest<any>(`/fields/${id}`, {
    method: 'DELETE',
  }),

  // Equipment
  getEquipment: async () => {
    const equipment = await apiRequest<any[]>('/equipment');
    if (!Array.isArray(equipment)) throw new Error('Invalid equipment response');
    return equipment.map(transformEquipment);
  },
  getEquipmentItem: (id: number) => apiRequest<any>(`/equipment/${id}`),
  createEquipment: (data: any) => apiRequest<any>('/equipment', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateEquipment: (id: number, data: any) => apiRequest<any>(`/equipment/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteEquipment: (id: number) => apiRequest<any>(`/equipment/${id}`, {
    method: 'DELETE',
  }),

  // Requests
  getRequests: async () => {
    const requests: StoredRequest[] = [];
    let after = 0;
    for (let page = 0; page < 20; page++) {
      const batch = await apiRequest<StoredRequest[]>(`/requests?after=${after}`);
      if (!Array.isArray(batch)) throw new Error('Invalid requests response');
      requests.push(...batch);
      if (batch.length < 500) return requests;
      const next = Number(batch[batch.length - 1].id);
      if (!Number.isSafeInteger(next) || next <= after) throw new Error('Invalid requests cursor');
      after = next;
    }
    throw new Error('Request archive is too large; archive reviewed requests before continuing');
  },
  createRequest: (type: StoredRequest['type'], data: FacilityRequest | EquipmentRequest | CancellationRequest, key: string) => apiRequest<{ id: string }>('/requests', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ ...data, type }),
  }),
  reviewRequest: async (id: string, status: 'Approved' | 'Rejected', fieldId?: string) => {
    const result = await apiRequest<{ request: StoredRequest; event?: unknown }>(`/requests/${id}/review`, {
      method: 'POST', body: JSON.stringify({ status, fieldId }),
    });
    return { request: result.request, event: result.event ? transformEvent(result.event) as Event : undefined };
  },

  // User Settings
  getSettings: () => apiRequest<Record<string, any>>('/settings'),
  
  getSetting: <T = unknown>(key: string) => apiRequest<T>(`/settings/${key}`),
  
  saveSetting: <T = any>(key: string, value: T) => 
    apiRequest<{ success: boolean; key: string }>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    }),
  
  deleteSetting: (key: string) => apiRequest<void>(`/settings/${key}`, {
    method: 'DELETE',
  }),

  // Health check
  healthCheck: () => apiRequest<any>('/health'),
};
