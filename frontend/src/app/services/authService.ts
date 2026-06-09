import { AuthResponse, RegisterData } from '../types/auth';
import API from '../api/axios';

const TOKEN_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'usuario';

export const authService = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const { data } = await API.post<AuthResponse>('/login/', { username, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
    return data;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const { data: response } = await API.post<AuthResponse>('/register/', data);
    localStorage.setItem(TOKEN_KEY, response.access_token);
    localStorage.setItem(REFRESH_KEY, response.refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.usuario));
    return response;
  },

  async refreshToken(): Promise<string | null> {
    const refresh_token = localStorage.getItem(REFRESH_KEY);
    if (!refresh_token) return null;
    try {
      const { data } = await API.post('/token/refresh/', { refresh_token });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      return data.access_token;
    } catch {
      this.logout();
      return null;
    }
  },

  async logout(): Promise<void> {
    const refresh_token = localStorage.getItem(REFRESH_KEY);
    try {
      await API.post('/logout/', { refresh_token });
    } catch {
      // Ignore errors, clear local state anyway
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async verifySession(): Promise<boolean> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;
    try {
      await API.get('/verify/');
      return true;
    } catch {
      return false;
    }
  },

  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },

  getStoredUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
};
