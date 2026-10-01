/**
 * Controles de paginacion: "Mostrando X-Y de Z" mas Anterior/Siguiente.
 *
 * No se pinta nada cuando todo el conjunto cabe en una sola pagina: los
 * botones vacios son ruido visual. El total Z viene de `count` del backend, no
 * del tamano del array, para no volver a presentar una pagina como un total.
 */
export default function Paginacion({ page, total, pageSize, totalPaginas, loading, onChange, etiqueta = 'elementos' }) {
  if (!total || totalPaginas <= 1) return null

  const desde = (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)

  return (
    <nav className="fr-paginacion" aria-label={`Paginación de ${etiqueta}`}>
      <span className="fr-paginacion-info">
        {loading ? 'Cargando…' : `Mostrando ${desde}–${hasta} de ${total} ${etiqueta}`}
      </span>
      <div className="fr-paginacion-botones">
        <button
          type="button"
          className="fr-btn-ghost"
          onClick={() => onChange(page - 1)}
          disabled={loading || page <= 1}
        >
          Anterior
        </button>
        <span className="fr-paginacion-info fr-mono">
          Página {page} de {totalPaginas}
        </span>
        <button
          type="button"
          className="fr-btn-ghost"
          onClick={() => onChange(page + 1)}
          disabled={loading || page >= totalPaginas}
        >
          Siguiente
        </button>
      </div>
    </nav>
  )
}