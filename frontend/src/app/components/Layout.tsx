import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Home, BarChart3, Settings, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isAdmin = user?.rol === 'admin';

  const handleLogout = async () => {
    await logout();
    navigate('/landing');
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
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-[#9FE0C3] to-[#9FBCE0] rounded-lg flex items-center justify-center">
                  <span className="text-white text-xl font-bold">G</span>
                </div>
                <span className="font-bold text-xl">GameStats</span>
              </div>

              <div className="hidden md:flex items-center gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-[#9FE0C3] to-[#9FBCE0] text-white shadow-md'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        <div className="md:hidden border-t border-border">
          <div className="flex justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'text-[#9FBCE0]'
                      : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
