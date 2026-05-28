import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Home, BarChart3, Settings, LogOut, Shield } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const raw = localStorage.getItem('usuario');
  const usuario = raw ? JSON.parse(raw) : null;
  const isAdmin = usuario?.rol === 'admin';

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  const navItems = [
    { path: '/home', icon: Home, label: 'Inicio' },
    { path: '/stats', icon: BarChart3, label: 'Estadísticas' },
    { path: '/settings', icon: Settings, label: 'Configuración' },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : [])
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-cen