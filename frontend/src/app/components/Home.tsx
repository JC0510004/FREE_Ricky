import { Lock, CheckCircle2, Star, Clock, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const levels = [
  { id: 1, name: 'Tutorial Valley', difficulty: 'Fácil', status: 'completed', stars: 3, time: '2:45' },
  { id: 2, name: 'Green Hills Zone', difficulty: 'Fácil', status: 'completed', stars: 3, time: '3:12' },
  { id: 3, name: 'Crystal Caves', difficulty: 'Media', status: 'completed', stars: 2, time: '5:34' },
  { id: 4, name: 'Lava Mountain', difficulty: 'Media', status: 'active', stars: 1, time: '4:22' },
  { id: 5, name: 'Sky Fortress', difficulty: 'Difícil', status: 'locked', stars: 0, time: '--:--' },
  { id: 6, name: 'Dark Abyss', difficulty: 'Difícil', status: 'locked', stars: 0, time: '--:--' },
  { id: 7, name: 'Final Challenge', difficulty: 'Extremo', status: 'locked', stars: 0, time: '--:--' }
];

export function Home() {
  const { user } = useAuth();
  const userName = user?.username || 'Jugador';

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Fácil': return 'bg-[#9FE0C3] text-white';
      case 'Media': return 'bg-[#9FDDE0] text-white';
      case 'Difícil': return 'bg-[#9FBCE0] text-white';
      case 'Extremo': return 'bg-gradient-to-r from-red-500 to-purple-600 text-white';
      default: return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="mb-2">¡Bienvenido, {userName}!</h1>
        <p className="text-muted-foreground">Continúa tu aventura en Platform Master</p>
      </div>

      {/* Levels */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Star className="w-6 h-6 text-[#9FDDE0]" />
          <h2>Progreso de Niveles</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {levels.map((level) => (
            <div
              key={level.id}
              className={`bg-white rounded-xl shadow-md p-5 transition-all ${
                level.status === 'locked'
                  ? 'opacity-60'
                  : 'hover:shadow-lg cursor-pointer'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      level.status === 'completed' ? 'bg-[#9FE0C3]' :
                      level.status === 'active' ? 'bg-[#9FDDE0]' :
                      'bg-muted'
                    }`}>
                      {level.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : level.status === 'locked' ? (
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <Target className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-base">{level.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(level.difficulty)}`}>
                        {level.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= level.stars
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{level.time}</span>
                </div>
              </div>

              {level.status === 'active' && (
                <button className="w-full mt-4 bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] text-foreground py-2 rounded-lg hover:opacity-90 transition-opacity font-medium">
                  Continuar Nivel
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 p-6 bg-gradient-to-r from-[#9FE0C3]/10 via-[#9FDDE0]/10 to-[#9FBCE0]/10 rounded-xl border border-[#9FBCE0]/30">
        <div className="text-center">
          <p className="font-medium mb-1">Progreso Total: 57%</p>
          <div className="w-full max-w-md mx-auto bg-white rounded-full h-3 overflow-hidden">
            <div className="bg-gradient-to-r from-[#9FE0C3] to-[#9FBCE0] h-full rounded-full" style={{ width: '57%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
