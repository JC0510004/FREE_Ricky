export function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const DIFFICULTY_CONFIG = {
  facil: { label: 'Fácil', color: '#4ade80', icon: 'star' },
  medio: { label: 'Medio', color: '#fbbf24', icon: 'star_half' },
  dificil: { label: 'Difícil', color: '#ef4444', icon: 'local_fire_department' },
};

export const BADGE_MAP = { facil: 'F', medio: 'M', dificil: 'D' };

// Extrae un mensaje de error legible desde la respuesta de error del backend
// (DRF). Maneja estructuras anidadas: strings, arrays de errores, dicts
// {campo: [errores]} y NonFieldErrors, evitando "[object Object]".
export function extractApiError(respData, fallback = 'Ocurrió un error') {
  if (!respData) return fallback

  const parts = []
  const collect = (value) => {
    if (value == null) return
    if (typeof value === 'string') { if (value.trim()) parts.push(value); return }
    if (Array.isArray(value)) { value.forEach(collect); return }
    if (typeof value === 'object') {
      if (Array.isArray(value.non_field_errors)) collect(value.non_field_errors)
      Object.values(value).forEach(collect)
      return
    }
    // números, booleanos, etc.
    parts.push(String(value))
  }
  collect(respData)

  const unique = [...new Set(parts)]
  return unique.length ? unique.join(' · ') : fallback
}
