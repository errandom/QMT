import { User } from './types'

export const DEFAULT_USER: User = {
  id: 'user-1',
  username: 'QMTadmin',
  password: 'Renegades!1982',
  role: 'admin',
  isActive: true
}

export function authenticateUser(username: string, password: string): User | null {
  if (username === DEFAULT_USER.username && password === DEFAULT_USER.password) {
    return DEFAULT_USER
  }
  return null
}

export function hasAccess(user: User | null): boolean {
  return user !== null && user.isActive && (user.role === 'admin' || user.role === 'mgmt')
}