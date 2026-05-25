import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Target, Award, Zap } from 'lucide-react';

const mockWeeklyData = [
  { day: 'Lun', score: 450 },
  { day: 'Mar', score: 680 },
  { day: 'Mié', score: 520 },
  { day: 'Jue', score: 890 },
  { day: 'Vie', score: 1020 },
  { day: 'Sáb', score: 1240 },
  { day: 'Dom', score: 980 }
];

const mockMonthlyData = [
  { month: 'Ene', score: 4200 },
  { month: 'Feb', score: 5100 },
  { month: 'Mar', score: 4800 },
  { month: 'Abr', score: 6400 },
  { month: 'May', score: 7800 }
];

export function Stats() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 h-8 text-[#9FBCE0]" />
          <h1>Mis Estadísticas</h1>
        </div>
        <p className="text-muted-foreground">Análisis detallado de tu rendimiento personal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-[#9FE0C3] to-[#9FE0C3]/70 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Target className="w-8 h-8" />
            <span className="text-sm opacity-90">Total</span>
          </div>
          <p className="text-3xl font-bold mb-1">12,450</p>
          <p className="text-sm opacity-90">Puntos acumulados</p>
        </div>

        <div className="bg-gradient-to-br from-[#9FDDE0] to-[#9FDDE0]/70 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Award className="w-8 h-8" />
            <span className="text-sm opacity-90">Ranking</span>
          </div>
          <p className="text-3xl font-bold mb-1">#24</p>
          <p className="text-sm opacity-90">Posición global</p>
        </div>

        <div className="bg-gradient-to-br from-[#9FBCE0] to-[#9FBCE0]/70 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Zap className="w-8 h-8" />
            <span className="text-sm opacity-90">Racha</span>
          </div>
          <p className="text-3xl font-bold mb-1">7 días</p>
          <p className="text-sm opacity-90">Racha actual</p>
        </div>

        <div className="bg-gradient-to-br from-[#7ec8a9] to-[#7ec8a9]/70 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8" />
            <span className="text-sm opacity-90">Progreso</span>
          </div>
          <p className="text-3xl font-bold mb-1">+28%</p>
          <p className="text-sm opacity-90">vs. mes anterior</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="mb-6">Rendimiento Semanal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockWeeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
              <XAxis dataKey="day" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="score" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9FBCE0" />
                  <stop offset="100%" stopColor="#9FE0C3" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="mb-6">Progreso Mensual</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#9FBCE0"
                strokeWidth={3}
                dot={{ fill: '#9FBCE0', r: 6 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
        <h3 className="mb-4">Logros Recientes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gradient-to-r from-[#9FE0C3]/20 to-[#9FE0C3]/10 rounded-xl border border-[#9FE0C3] flex items-center gap-4">
            <div className="w-12 h-12 bg-[#9FE0C3] rounded-full flex items-center justify-center text-2xl">
              🏆
            </div>
            <div>
              <p className="font-medium">Primera Victoria</p>
              <p className="text-sm text-muted-foreground">Hace 2 días</p>
            </div>
          </div>
          <div className="p-4 bg-gradient-to-r from-[#9FDDE0]/20 to-[#9FDDE0]/10 rounded-xl border border-[#9FDDE0] flex items-center gap-4">
            <div className="w-12 h-12 bg-[#9FDDE0] rounded-full flex items-center justify-center text-2xl">
              🔥
            </div>
            <div>
              <p className="font-medium">Racha de 7 días</p>
              <p className="text-sm text-muted-foreground">Activo ahora</p>
            </div>
          </div>
          <div className="p-4 bg-gradient-to-r from-[#9FBCE0]/20 to-[#9FBCE0]/10 rounded-xl border border-[#9FBCE0] flex items-center gap-4">
            <div className="w-12 h-12 bg-[#9FBCE0] rounded-full flex items-center justify-center text-2xl">
              ⭐
            </div>
            <div>
              <p className="font-medium">10K Puntos</p>
              <p className="text-sm text-muted-foreground">Hace 1 semana</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
