export interface Usuario {
  id: number;
  username: string;
  email: string;
  rol: 'admin' | 'jugador';
  fecha_registro: string;
  is_active: boolean;
  is_verified: boolean;
  last_login: string | null;
}

export interface AuthResponse {
  mensaje: string;
  usuario: Usuario;
  access_token: string;
  refresh_token: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
}
