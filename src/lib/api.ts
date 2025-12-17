// API Configuration Module
// Used by frontend to get the correct API base URL

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
  return user ? JSON.parse(user) : null;
}

export function setStoredUser(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Data transformation utilities to convert between database snake_case and frontend camelCase
function transformTeam(team: any): any {
  if (!team) return team;
  return {
    ...team,
    // Ensure id is string
    id: String(team.id || ''),
    // Handle sport field - could be 'sport' or 'sportType'
    sportType: team.sportType || team.sport,
    // Handle active field - could be number (0/1) or boolean - convert to boolean for consistency
    isActive: team.isActive !== undefined ? Boolean(team.isActive) : (team.active !== undefined ? Boolean(team.active) : true),
    // Handle coach fields
    headCoach: team.headCoach || team.head_coach,
    teamManager: team.teamManager || team.team_manager,
    // Handle roster size
    rosterSize: team.rosterSize || team.roster_size
  };
}

function transformSite(site: any): any {
  if (!site) return site;
  return {
    ...site,
    id: String(site.id || ''),
    zipCode: site.zipCode || site.zip_code,
    contactFirstName: site.contactFirstName || site.contact_first_name,
    contactLastName: site.contactLastName || site.contact_last_name,
    contactPhone: site.contactPhone || site.contact_phone,
    contactEmail: site.contactEmail || site.contact_email,
    isSportsFacility: site.isSportsFacility !== undefined ? Boolean(site.isSportsFacility) : (site.is_sports_facility !== undefined ? Boolean(site.is_sports_facility) : false),
    isActive: site.isActive !== undefined ? Boolean(site.isActive) : (site.active !== undefined ? Boolean(site.active) : true)
  };
}

function transformField(field: any): any {
  if (!field) return field;
  return {
    ...field,
    id: String(field.id || ''),
    siteId: String(field.siteId || field.site_id || ''),
    turfType: field.turfType || field.turf_type,
    hasLights: field.hasLights !== undefined ? Boolean(field.hasLights) : (field.has_lights !== undefined ? Boolean(field.has_lights) : false),
    fieldSize: field.fieldSize || field.field_size,
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
  return {
    ...event,
    id: String(event.id || ''),
    eventType: event.eventType || event.event_type,
    teamId: String(event.teamId || event.team_id || ''),
    fieldId: String(event.fieldId || event.field_id || '')
  };
}

// Helper function to make API calls
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add authentication token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid - clear auth state
      removeToken();
    }
    const error = await response.json().catch(() => ({ 
      error: 'An error occurred' 
    }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
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
  getCurrentUser: () => apiRequest<any>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<any>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Events
  getEvents: async () => {
    const events = await apiRequest<any[]>('/events');
    console.log('[API] Raw events from server:', events);
    return events.map(transformEvent);
  },
  getEvent: (id: number) => apiRequest<any>(`/events/${id}`),
  createEvent: (data: any) => apiRequest<any>('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateEvent: (id: number, data: any) => apiRequest<any>(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteEvent: (id: number) => apiRequest<any>(`/events/${id}`, {
    method: 'DELETE',
  }),

  // Teams
  getTeams: async () => {
    const teams = await apiRequest<any[]>('/teams');
    console.log('[API] Raw teams from server:', teams);
    const transformed = teams.map(transformTeam);
    console.log('[API] Transformed teams:', transformed);
    return transformed;
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
    console.log('[API] Raw sites from server:', sites);
    const transformed = sites.map(transformSite);
    console.log('[API] Transformed sites:', transformed);
    return transformed;
  },
  getSite: (id: number) => apiRequest<any>(`/sites/${id}`),
  createSite: (data: any) => apiRequest<any>('/sites', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateSite: (id: number, data: any) => apiRequest<any>(`/sites/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteSite: (id: number) => apiRequest<any>(`/sites/${id}`, {
    method: 'DELETE',
  }),

  // Fields
  getFields: async () => {
    const fields = await apiRequest<any[]>('/fields');
    console.log('[API] Raw fields from server:', fields);
    const transformed = fields.map(transformField);
    console.log('[API] Transformed fields:', transformed);
    return transformed;
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
    console.log('[API] Raw equipment from server:', equipment);
    const transformed = equipment.map(transformEquipment);
    console.log('[API] Transformed equipment:', transformed);
    return transformed;
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
  getRequests: (params?: { type?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<any[]>(`/requests${query ? `?${query}` : ''}`);
  },
  getRequest: (id: number) => apiRequest<any>(`/requests/${id}`),
  createRequest: (data: any) => apiRequest<any>('/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateRequest: (id: number, data: any) => apiRequest<any>(`/requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteRequest: (id: number) => apiRequest<any>(`/requests/${id}`, {
    method: 'DELETE',
  }),

  // Health check
  healthCheck: () => apiRequest<any>('/health'),
};
