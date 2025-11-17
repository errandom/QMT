export type SportType = 'Tackle Football' | 'Flag Football'
export type EventType = 'Game' | 'Practice' | 'Meeting' | 'Other'
export type EventStatus = 'Planned' | 'Confirmed' | 'Cancelled'
export type TurfType = 'Natural Turf' | 'Artificial Turf'
export type FieldSize = 'Full' | 'Shared'
export type RosterSize = '< 15' | '16-30' | '> 30'
export type UserRole = 'admin' | 'mgmt' | 'user'
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected'
export type PlanningPeriod = 'Autumn' | 'Winter' | 'Spring' | 'Summer'

export interface Amenity {
  parking: boolean
  toilets: boolean
  lockerRooms: boolean
  shower: boolean
  restaurant: boolean
  equipmentStash: boolean
}

export interface Site {
  id: string
  name: string
  address: string
  zipCode: string
  city: string
  latitude: number
  longitude: number
  contactFirstName: string
  contactLastName: string
  contactPhone: string
  contactEmail: string
  isSportsFacility: boolean
  amenities: Amenity
  isActive: boolean
}

export interface Field {
  id: string
  name: string
  siteId: string
  turfType: TurfType
  hasLights: boolean
  fieldSize: FieldSize
  capacity?: number
  isActive: boolean
}

export interface Contact {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface Team {
  id: string
  name: string
  sportType: SportType
  headCoach?: Contact
  teamManager?: Contact
  rosterSize?: RosterSize
  isActive: boolean
}

export interface Event {
  id: string
  title: string
  eventType: EventType
  status: EventStatus
  date: string
  startTime: string
  endTime: string
  fieldId?: string
  teamIds: string[]
  otherParticipants?: string
  estimatedAttendance?: number
  notes?: string
  isRecurring: boolean
  recurringDays?: number[]
  recurringEndDate?: string
}

export interface FacilityRequest {
  id: string
  requestorName: string
  requestorPhone: string
  eventType: EventType
  teamIds?: string[]
  purpose?: string
  opponent?: string
  date: string
  startTime: string
  duration: number
  description?: string
  status: RequestStatus
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
}

export interface EquipmentRequest {
  id: string
  requestorName: string
  requestorPhone: string
  teamIds: string[]
  date: string
  equipmentDescription: string
  status: RequestStatus
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
}

export interface CancellationRequest {
  id: string
  requestorName: string
  requestorPhone: string
  eventId: string
  eventTitle: string
  eventDate: string
  eventTime: string
  justification: string
  status: RequestStatus
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
}

export interface Equipment {
  id: string
  name: string
  description?: string
  quantity: number
  assignedTeamId?: string
}

export interface User {
  id: string
  username: string
  password: string
  role: UserRole
  isActive: boolean
}

export interface WeatherForecast {
  temperature: number
  condition: string
  icon: string
}