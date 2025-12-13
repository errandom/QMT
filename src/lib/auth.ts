import { User } from './types'
import { api, getStoredUser, removeToken, getToken } from './api'

/**
 * Check if the user has access to operations office features
 * Admin and management users have access
 */
export function hasAccess(user: User | null): boolean {
  return user !== null && user.isActive && (user.role === 'admin' || user.role === 'mgmt')
}

/**
 * Check if the user is an admin
 */
export function isAdmin(user: User | null): boolean {
  return user !== null && user.isActive && user.role === 'admin'
}

/**
 * Get the current authenticated user from storage
 */
export function getCurrentUser(): User | null {
  const storedUser = getStoredUser()
  const token = getToken()
  
  if (!storedUser || !token) {
    return null
  }
  
  return storedUser
}

/**
 * Logout the current user by removing token and user data
 */
export function logout(): void {
  removeToken()
}

/**
 * Verify the current token is still valid by making an API call
 */
export async function verifyToken(): Promise<boolean> {
  try {
    const token = getToken()
    if (!token) return false
    
    // Try to fetch current user to verify token
    await api.getCurrentUser()
    return true
  } catch (error) {
    // Token is invalid or expired
    removeToken()
    return false
  }
}
