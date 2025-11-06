export type SportType = 'tackle' | 'flag';
export type EventType = 'practice' | 'game' | 'meeting' | 'other';
export type EventStatus = 'planned' | 'confirmed' | 'cancelled';

export interface Team {
  id: string;
  name: string;
  sportType: SportType;
  isActive: boolean;
  headCoachName?: string;
  headCoachEmail?: string;
  headCoachPhone?: string;
  teamManagerName?: string;
  teamManagerEmail?: string;
  teamManagerPhone?: string;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: string;
  longitude?: string;
  isActive: boolean;
  hasToilets: boolean;
  hasLockerRooms: boolean;
  hasEquipmentStash: boolean;
  hasRestaurant: boolean;
}

export interface Field {
  id: string;
  name: string;
  siteId: string;
  turfType: 'artificial' | 'natural';
  hasLights: boolean;
  isFullField: boolean;
  capacity?: number;
}

export interface ScheduleEvent {
  id: string;
  fieldId: string;
  teamIds: string[];
  startTime: string;
  endTime: string;
  eventType: EventType;
  status: EventStatus;
  estimatedAttendance?: number;
  opponent?: string;
  notes?: string;
  isRecurring: boolean;
  recurringDays?: number[];
  recurringStartDate?: string;
  recurringEndDate?: string;
}

export interface Request {
  id: string;
  type: 'facility' | 'equipment' | 'cancellation';
  teamId?: string;
  requestedBy: string;
  requestedDate: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  fieldId?: string;
  siteId?: string;
  eventId?: string;
  reason?: string;
}

export interface User {
  id: string;
  username: string;
  role: 'QMTadmin' | 'QMTmgmt';
  email?: string;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  role: 'QMTadmin' | 'QMTmgmt' | null;
  username: string | null;
}
