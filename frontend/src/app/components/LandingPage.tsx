import { useNavigate } from 'react-router';
import { Download, Trophy, Play, Star, Zap, Award } from 'lucide-react';
import { useState, useEffect } from 'react';
import API from '../api/axios';
interface Usuario {
  id: number;
  username: string;
  email: string;
}

export function LandingPage() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<Usuario[]>([]);

  useEffect(() => {
    API.get('/usuarios/')
      .then(res => setRankings(res.data.slice(0, 5)))
      .catch(() => setRankings([]));
  }, []);

  const avatars = ['🏆', '🥈', '🥉', '⭐', '🎮'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl">
                <span className="text-4xl">🎮</span>
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
              Platform Master
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
              Salta, corre y conquista los niveles más desafiantes en el mejor juego de plataformas
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button className="group bg-white text-foreground px-8 py-4 rounded-xl shadow-2xl hover:shadow-3xl transition-all flex items-center gap-3 hover:scale-105">
                <Download className="w-6 h-6" />
                <div className="text-left">
                  <p className="font-bold">Descargar Gratis</p>
                  <p className="text-sm text-muted-foreground">Windows, Mac & Linux</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/login')}
                className="bg-[#9FBCE0] text-white px-8 py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-2 hover:scale-105"
              >
                <Play className="w-5 h-5" />
                Jugar Ahora
              </button>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="text-white hover:underline"
              >
                ¿Ya tienes cuenta? Inicia sesión
              </button>
              <span className="text-white">|</span>
              <button
                onClick={() => navigate('/register')}
                className="text-white hover:underline"
              >
                Crear cuenta nueva
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-[#9FE0C3] to-[#9FE0C3]/70 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="mb-2">100+ Niveles</h3>
              <p className="text-muted-foreground">
                Explora mundos únicos con desafíos cada vez más emocionantes
              </p>
            </div>

            <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-[#9FDDE0] to-[#9FDDE0]/70 rounded-xl flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h3 className="mb-2">Rankings Globales</h3>
              <p className="text-muted-foreground">
                Compite con jugadores de todo el mundo y demuestra tu habilidad
              </p>
            </div>

            <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-[#9FBCE0] to-[#9FBCE0]/70 rounded-xl flex items-center justify-center mb-4">
                <Star className="w-6 h-6 text-white" />
              </div>
              <h3 className="mb-2">Desbloquea Poderes</h3>
              <p className="text-muted-foreground">
                Obtén habilidades especiales y mejora tu personaje
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Ranking Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Trophy className="w-10 h-10 text-[#9FBCE0]" />
              <h2 className="text-4xl font-bold">Top Jugadores</h2>
            </div>
            <p className="text-muted-foreground text-lg">Los mejores del mundo en Platform Master</p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="bg-gradient-to-r from-[#9FE0C3]/10 via-[#9FDDE0]/10 to-[#9FBCE0]/10 rounded-2xl shadow-xl overflow-hidden border border-[#9FBCE0]/20">
              <div className="bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
                <h3 className="text-white text-center">🏆 Hall of Fame 🏆</h3>
              </div>

              <div className="divide-y divide-border">
                {rankings.map((player, index) => (
                  <div
                    key={player.id}
                    className="p-5 hover:bg-muted/30 transition-colors flex items-center gap-4"
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                      index === 2 ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                      'bg-gradient-to-br from-[#9FE0C3] to-[#9FBCE0]'
                    }`}>
                      {index <= 2 ? (
                        <span className="text-2xl">{avatars[index]}</span>
                      ) : (
                        <span className="font-bold">#{index + 1}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-1">
                        <p className="font-bold text-lg">{player.username}</p>
                        <p className="text-muted-foreground">Jugador registrado</p>
                      </div>
                    </div>

                    {index <= 2 && (
                      <Award className={`w-8 h-8 ${
                        index === 0 ? 'text-yellow-500' :
                        index === 1 ? 'text-gray-400' :
                        'text-amber-600'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gradient-to-r from-[#9FE0C3]/10 to-[#9FBCE0]/10 text-center">
                <p className="text-muted-foreground">
                  ¡Únete ahora y conviértete en el próximo campeón! 🎮
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            ¿Listo para la aventura?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Únete a miles de jugadores y comienza tu camino hacia la cima
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="bg-white text-foreground px-8 py-4 rounded-xl shadow-2xl hover:shadow-3xl transition-all font-bold hover:scale-105"
            >
              Crear Cuenta Gratis
            </button>
            <button className="bg-[#9FBCE0] text-white px-8 py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all font-bold hover:scale-105 flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />
              Descargar Juego
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#1a1a2e] text-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-white/70">© 2026 Platform Master. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}
