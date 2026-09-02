export function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const DIFFICULTY_CONFIG = {
  facil: { label: 'Fácil', color: '#4ade80', icon: 'star' },
  medio: { label: 'Medio', color: '#fbbf24', icon: 'star_half' },
  dificil: { label: 'Difícil', color: '#ef4444', icon: 'local_fire_department' },
};

export const BADGE_MAP = { facil: 'F', medio: 'M', dificil: 'D' };
