import { useState, useEffect, useCallback } from 'react'
import API from '../api/axios'

/**
 * Pagina una lista de DRF leyendo `count` de la respuesta.
 *
 * El fallo que arregla: el panel de admin pedia solo la primera pagina y
 * descartaba el resto. Con mas de `pageSize` elementos, todos los siguientes
 * eran invisibles de forma permanente, sin paginacion siguiente ni anterior que
 * llegara a ellos. Ademas el badge pintaba `items.length` como si fuera el
 * total, que solo coincide con la realidad mientras todo quepa en la primera
 * pagina.
 *
 * `pageSize` NO se deduce de la respuesta: DRF devuelve
 * {count, next, previous, results} y no incluye el tamano de pagina. Se pasa
 * explicitamente para que el rango "1-50 de 312" sea cierto, y cada consumidor
 * declara el suyo junto al endpoint que lo define.
 *
 * Devuelve ademas `reload()` para refrescar conservando la pagina actual, que
 * es lo que hace falta tras crear, editar o borrar.
 */
export default function usePaginada(url, pageSize) {
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Sube en cada reload() para re-disparar el efecto sin duplicar el fetch.
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!url) return

    const controller = new AbortController()
    let cancelled = false

    const doFetch = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await API.get(url, { params: { page }, signal: controller.signal })
        if (cancelled) return

        const data = response.data
        // Endpoint sin paginar: llega la lista plana, no un objeto con 'results'.
        if (Array.isArray(data)) {
          setItems(data)
          setTotal(data.length)
        } else {
          setItems(Array.isArray(data?.results) ? data.results : [])
          setTotal(Number(data?.count) || 0)

          // Se ha borrado la ultima fila de la ultima pagina: en vez de dejar
          // una tabla vacia, retrocede a la pagina que aun tiene contenido.
          if (page > 1 && Array.isArray(data?.results) && data.results.length === 0) {
            setPage((p) => p - 1)
          }
        }
      } catch (err) {
        // El aborto de React no es un fallo de red: no debe pintar error.
        if (!cancelled && err?.name !== 'CanceledError' && err?.name !== 'AbortError') {
          setError(err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    doFetch()
    return () => { cancelled = true; controller.abort() }
  }, [url, page, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const irA = useCallback((p) => setPage(Math.max(1, p)), [])

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize))

  return { items, total, page, pageSize, totalPaginas, loading, error, reload, irA, setPage }
}