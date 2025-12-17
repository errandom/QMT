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
  return {
    ...team,
    id: team.id?.toString() || '',
    sportType: team.sport || team.sportType,
    isActive: team.active !== undefined ? team.active : team.isActive,
    headCoach: team.head_coach || team.headCoach,
    teamManager: team.team_manager || team.teamManager,
    rosterSize: team.roster_size || team.rosterSize
  };
}

function transformSite(site: any): any {
  return {
    ...site,
    id: site.id?.toString() || '',
    zipCode: site.zip_code || site.zipCode,
    contactFirstName: site.contact_first_name || site.contactFirstName,
    contactLastName: site.contact_last_name || site.contactLastName,
    contactPhone: site.contact_phone || site.contactPhone,
    contactEmail: site.contact_email || site.contactEmail,
    isSportsFacility: site.is_sports_facility !== undefined ? site.is_sports_facility : site.isSportsFacility,
    isActive: site.active !== undefined ? site.active : site.isActive
  };
}

function transformField(field: any): any {
  return {
    ...field,
    id: field.id?.toString() || '',
    siteId: (field.site_id || field.siteId)?.toString() || '',
    turfType: field.turf_type || field.turfType,
    hasLights: field.has_lights !== undefined ? field.has_lights : field.hasLights,
    fieldSize: field.field_size || field.fieldSize,
    isActive: field.active !== undefined ? field.active : field.isActive
  };
}

function transformEquipment(equipment: any): any {
  return {
    ...equipment,
    id: equipment.id?.toString() || '',
    isActive: equipment.active !== undefined ? equipment.active : equipment.isActive
  };
}

function transformEvent(event: any): any {
  return {
    ...event,
    id: event.id?.toString() || '',
    eventType: event.event_type || event.eventType,
    teamId: (event.team_id || event.teamId)?.toString() || '',
    fieldId: (event.field_id || event.fieldId)?.toString() || '',
    organizerId: (event.organizer_id || event.organizerId)?.toString() || ''
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
