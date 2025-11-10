import { useKV } from '@github/spark/hooks';
import { AuthState } from '@/lib/types';

const CREDENTIALS = {
  QMTadmin: 'Renegades!1982',
  QMTmgmt: 'Renegades!1982'
};

export function useAuth() {
  const [authState, setAuthState] = useKV<AuthState>('authState', {
    isAuthenticated: false,
    role: null,
    username: null
  });

  const login = (username: string, password: string): boolean => {
    if (username === 'QMTadmin' && password === CREDENTIALS.QMTadmin) {
      setAuthState((current) => ({
        isAuthenticated: true,
        role: 'QMTadmin',
        username: 'QMTadmin'
      }));
      return true;
    } else if (username === 'QMTmgmt' && password === CREDENTIALS.QMTmgmt) {
      setAuthState((current) => ({
        isAuthenticated: true,
        role: 'QMTmgmt',
        username: 'QMTmgmt'
      }));
      return true;
    }
    return false;
  };

  const logout = () => {
    setAuthState((current) => ({
      isAuthenticated: false,
      role: null,
      username: null
    }));
  };

  return {
    authState,
    login,
    logout,
    isAdmin: authState?.role === 'QMTadmin'
  };
}
