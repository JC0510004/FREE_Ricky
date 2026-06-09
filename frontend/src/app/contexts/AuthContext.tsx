import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Usuario } from '../types/auth';
import { authService } from '../services/authService';

interface AuthContextType {
  user: Usuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(authService.getStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const stored = authService.getStoredUser();
      if (!stored) {
        setIsLoading(false);
        return;
      }
      const valid = await authService.verifySession();
      if (!valid) {
        setUser(null);
      }
      setIsLoading(false);
    };
    verify();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await authService.login(username, password);
    setUser(response.usuario);
  }, []);

  const register = useCallback(async (data: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => {
    const response = await authService.register(data);
    setUser(response.usuario);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const checkSession = useCallback(async () => {
    const valid = await authService.verifySession();
    if (!valid) {
      setUser(null);
    }
    return valid;
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, register, logout, checkSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
