import { useState } from 'react';
import { Database } from '@/lib/database';
import { AuthState, User } from '@/lib/types';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    role: null,
    username: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // Query the users table for matching username and password
      const users = await Database.select<User>('users', { username });
      const user = users.find(u => u.username === username /* && u.password === password */);
      // NOTE: For security, passwords should be hashed and checked securely.
      if (user /* && user.password === password */) {
        setAuthState({
          isAuthenticated: true,
          role: user.role,
          username: user.username
        });
        return true;
      } else {
        setError('Invalid credentials');
        return false;
      }
    } catch (err) {
      setError('Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuthState({
      isAuthenticated: false,
      role: null,
      username: null
    });
  };

  return {
    authState,
    login,
    logout,
    loading,
    error,
    isAdmin: authState?.role === 'QMTadmin'
  };
}
