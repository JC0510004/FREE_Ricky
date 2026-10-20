// ─── TESTS: pages/Admin.jsx ───────────────────────────────────────────
// Se simulan: useAuth (quién es el usuario), la API (axios), usePaginada
// (las listas), Paginacion (para comprobar el cableado), useNavigate y confirm().
// El resto (pestañas, formularios, mensajes) es el componente real.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { auth, navegar, api, paginada, listados } = vi.hoisted(() => ({
  auth: { current: null },
  navegar: vi.fn(),
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
  paginada: vi.fn(),
  listados: { current: {} },
}))

vi.mock('../../contexts/useAuth', () => ({ useAuth: () => auth.current }))
vi.mock('../../api/axios', () => ({ default: api }))
vi.mock('../../hooks/usePaginada', () => ({ default: (...args) => paginada(...args) }))
vi.mock('../../utils/format', () => ({
  // Versión simple y predecible: usa "detalle" del backend o el texto por defecto.
  extractApiError: (data, porDefecto) => data?.detalle || porDefecto,
}))
vi.mock('../../components/Paginacion', () => ({
  default: (p) => (
    <button type="button" onClick={() => p.onChange(2)}>
      {`pagina-${p.etiqueta}`}
    </button>
  ),
}))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navegar,
}))

import Admin from '../Admin'

// ─── Datos de ejemplo ─────────────────────────────────────────────────
const ADMIN = { id: 1, username: 'admin', rol: 'admin' }

const USUARIOS = [
  { id: 1, username: 'admin', email: 'a@a.com', rol: 'admin', fecha_registro: '2026-01-05T12:00:00Z' },
  { id: 2, username: 'juan', email: 'j@j.com', rol: 'jugador', fecha_registro: null },
]

const NIVELES = [
  { id: 10, nombre: 'Isla', dificultad: 'facil', tiempo_limite: 120, fecha_creacion: '2026-02-01T12:00:00Z' },
  { id: 11, nombre: 'Tormenta', dificultad: 'dificil', tiempo_limite: null, fecha_creacion: '2026-02-02T12:00:00Z' },
  { id: 12, nombre: 'Marea', dificultad: 'medio', tiempo_limite: 60, fecha_creacion: '2026-02-03T12:00:00Z' },
]

const PARTIDAS = [
  { usuario_username: 'ana', puntos_totales: 450, mejor_puntuacion: 450, muertes_totales: 7, tiempo_total: null, num_partidas: 1 },
  { usuario_username: 'luis', puntos_totales: 700, mejor_puntuacion: 700, muertes_totales: 1, tiempo_total: 59, num_partidas: 1 },
  { usuario_username: 'juan', puntos_totales: 1350, mejor_puntuacion: 900, muertes_totales: 5, tiempo_total: 205, num_partidas: 3 },
]

const STATS = {
  total_usuarios: 12,
  total_niveles: 4,
  total_partidas: 87,
  mejor_puntuacion_global: 9800,
  promedio_puntuacion_global: 4300,
  total_muertes_global: 321,
  jugador_mas_activo: 'pirata_loco',
}

function hacerListado(extra = {}) {
  return {
    items: [], total: 0, page: 1, pageSize: 50, totalPaginas: 1,
    loading: false, error: null, reload: vi.fn(), setPage: vi.fn(),
    ...extra,
  }
}

function usarAuth(extra = {}) {
  auth.current = {
    user: ADMIN, isAuthenticated: true, isLoading: false, tokenReady: true,
    logout: vi.fn(), updateUser: vi.fn(),
    ...extra,
  }
}

function renderAdmin() {
  return render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>
  )
}

const irA = (pestana) => fireEvent.click(screen.getByRole('button', { name: pestana }))

// Valor numérico de una tarjeta del resumen (el <p> anterior a su etiqueta).
const valorDe = (etiqueta) =>
  screen
    .getAllByText(etiqueta)
    .find((el) => el.tagName === 'P')
    .previousElementSibling.textContent

beforeEach(() => {
  navegar.mockReset()
  Object.values(api).forEach((f) => f.mockReset())
  api.get.mockResolvedValue({ data: STATS })
  usarAuth()
  listados.current = {}
  paginada.mockReset()
  paginada.mockImplementation((url) => listados.current[url] ?? hacerListado())
  vi.stubGlobal('confirm', vi.fn(() => true))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ══════════════════════════════════════════════════════════════════════
describe('Admin - acceso y estructura', () => {
  it('mientras carga la sesión no muestra nada ni redirige', () => {
    usarAuth({ isLoading: true, user: null })
    const { container } = renderAdmin()
    expect(container.firstChild).toBeNull()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('sin sesión redirige al inicio y no pinta el panel', () => {
    usarAuth({ isAuthenticated: false, user: null })
    const { container } = renderAdmin()
    expect(navegar).toHaveBeenCalledWith('/')
    expect(container.firstChild).toBeNull()
  })

    it('un jugador (no admin) es enviado a /home', async () => {
    usarAuth({ user: { id: 2, username: 'juan', rol: 'jugador' } })
    renderAdmin()
    expect(navegar).toHaveBeenCalledWith('/home')
    await screen.findByText('Mejor puntuación')
  })

    it('un admin no es redirigido', async () => {
    renderAdmin()
    expect(navegar).not.toHaveBeenCalled()
    await screen.findByText('Mejor puntuación')
  })

  it('si el token aún no está listo muestra la carga y no pide datos', () => {
    usarAuth({ tokenReady: false })
    const { container } = renderAdmin()
    expect(container.querySelector('.fr-main')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Panel de Control' })).toBeNull()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('muestra el encabezado, el título y el enlace de volver', async () => {
    renderAdmin()
    expect(screen.getByRole('heading', { name: 'Panel de Control' })).toBeInTheDocument()
    expect(screen.getByText('FREE_RICKY')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volver al inicio/ }).getAttribute('href')).toBe('/')
    await screen.findByText('Mejor puntuación')
  })

  it('"Cerrar sesión" llama a logout', async () => {
    renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
    expect(auth.current.logout).toHaveBeenCalledTimes(1)
    await screen.findByText('Mejor puntuación')
  })

  it('tiene cuatro pestañas y "Resumen" está activa al inicio', async () => {
    renderAdmin()
    const nav = screen.getByRole('navigation', { name: 'Secciones de administración' })
    const botones = nav.querySelectorAll('button')
    expect([...botones].map((b) => b.textContent)).toEqual(['Resumen', 'Usuarios', 'Niveles', 'Partidas'])
    expect(screen.getByRole('button', { name: 'Resumen' }).className).toContain('fr-tab-active')
    expect(screen.getByRole('button', { name: 'Usuarios' }).className).not.toContain('fr-tab-active')
    await screen.findByText('Mejor puntuación')
  })

  it('cambiar de pestaña muestra su contenido y marca la activa', async () => {
    renderAdmin()
    await screen.findByText('Mejor puntuación')

    irA('Usuarios')
    expect(screen.getByText('Usuarios registrados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usuarios' }).className).toContain('fr-tab-active')
    expect(screen.queryByText('Mejor puntuación')).toBeNull()

    irA('Niveles')
    expect(screen.getByRole('button', { name: /Nuevo nivel/ })).toBeInTheDocument()

    irA('Partidas')
    expect(screen.getByText('Partidas registradas')).toBeInTheDocument()
  })

  it('cada pestaña pide su lista con 50 por página', () => {
    renderAdmin()
    irA('Usuarios')
    expect(paginada).toHaveBeenCalledWith('/usuarios/', 50)
    irA('Niveles')
    expect(paginada).toHaveBeenCalledWith('/niveles/', 50)
    irA('Partidas')
    expect(paginada).toHaveBeenCalledWith('/admin/partidas/', 50)
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Admin - pestaña Resumen', () => {
  it('pide las estadísticas al backend', async () => {
    renderAdmin()
    await screen.findByText('Mejor puntuación')
    expect(api.get).toHaveBeenCalledWith('/admin/stats/', expect.objectContaining({ signal: expect.anything() }))
  })

  it('muestra las seis métricas', async () => {
    renderAdmin()
    await screen.findByText('Mejor puntuación')
    expect(valorDe('Usuarios')).toBe('12')
    expect(valorDe('Niveles')).toBe('4')
    expect(valorDe('Partidas')).toBe('87')
    expect(valorDe('Mejor puntuación')).toBe('9800')
    expect(valorDe('Promedio global')).toBe('4300')
    expect(valorDe('Muertes totales')).toBe('321')
  })

  it('muestra el jugador más activo', async () => {
    renderAdmin()
    expect(await screen.findByText('pirata_loco')).toBeInTheDocument()
    expect(screen.getByText('Jugador más activo')).toBeInTheDocument()
  })

  it('si faltan datos muestra 0 y oculta el jugador más activo', async () => {
    api.get.mockResolvedValue({ data: {} })
    renderAdmin()
    await screen.findByText('Mejor puntuación')
    ;['Usuarios', 'Niveles', 'Partidas', 'Mejor puntuación', 'Promedio global', 'Muertes totales'].forEach(
      (e) => expect(valorDe(e)).toBe('0'),
    )
    expect(screen.queryByText('Jugador más activo')).toBeNull()
  })

  it('mientras carga no muestra las métricas', () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    renderAdmin()
    expect(screen.queryByText('Mejor puntuación')).toBeNull()
  })

  it('si la petición falla muestra "Error al cargar"', async () => {
    api.get.mockRejectedValue(new Error('500'))
    renderAdmin()
    expect(await screen.findByText('Error al cargar')).toBeInTheDocument()
  })

  it('al salir de la pestaña cancela la petición pendiente', () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    const { unmount } = renderAdmin()
    const { signal } = api.get.mock.calls[0][1]
    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Admin - pestaña Usuarios', () => {
  let lista

  beforeEach(() => {
    lista = hacerListado({ items: USUARIOS, total: 2 })
    listados.current['/usuarios/'] = lista
  })

  async function abrirUsuarios() {
    renderAdmin()
    await screen.findByText('Mejor puntuación')
    irA('Usuarios')
  }

  it('lista los usuarios con su correo, rol y el total', async () => {
    await abrirUsuarios()
    expect(screen.getByText('admin', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('juan')).toBeInTheDocument()
    expect(screen.getByText('a@a.com')).toBeInTheDocument()
    expect(screen.getByText('j@j.com')).toBeInTheDocument()
    expect(screen.getByText('2 usuarios')).toBeInTheDocument()
  })

  it('el badge del rol distingue admin de jugador', async () => {
    await abrirUsuarios()
    expect(screen.getByText('admin', { selector: 'span.fr-badge' }).className).toContain('fr-badge-hard')
    expect(screen.getByText('jugador', { selector: 'span.fr-badge' }).className).toContain('fr-badge-medium')
  })

  it('sin fecha de registro muestra "-"', async () => {
    await abrirUsuarios()
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('sin usuarios y sin cargar, avisa que no hay', async () => {
    listados.current['/usuarios/'] = hacerListado()
    await abrirUsuarios()
    expect(screen.getByText('No hay usuarios registrados')).toBeInTheDocument()
  })

  it('mientras carga no muestra el aviso de vacío', async () => {
    listados.current['/usuarios/'] = hacerListado({ loading: true })
    await abrirUsuarios()
    expect(screen.queryByText('No hay usuarios registrados')).toBeNull()
  })

  it('si la lista falla muestra "Error al cargar"', async () => {
    listados.current['/usuarios/'] = hacerListado({ error: true })
    await abrirUsuarios()
    expect(screen.getByText('Error al cargar')).toBeInTheDocument()
  })

  it('la paginación cambia de página', async () => {
    await abrirUsuarios()
    fireEvent.click(screen.getByRole('button', { name: 'pagina-usuarios' }))
    expect(lista.setPage).toHaveBeenCalledWith(2)
  })

  it('no deja eliminar la propia cuenta, pero sí las demás', async () => {
    await abrirUsuarios()
    const propia = screen.getByTitle('No puedes eliminar tu propia cuenta')
    expect(propia.disabled).toBe(true)
    expect(screen.getByTitle('Eliminar').disabled).toBe(false)
  })

  describe('editar', () => {
    it('al editar muestra los datos actuales en campos', async () => {
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[1])

      expect(screen.getByDisplayValue('juan')).toBeInTheDocument()
      expect(screen.getByDisplayValue('j@j.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Jugador')).toBeInTheDocument()
      expect(screen.getByTitle('Guardar')).toBeInTheDocument()
    })

    it('"Cancelar" descarta la edición', async () => {
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[1])
      fireEvent.change(screen.getByDisplayValue('juan'), { target: { value: 'otro' } })
      fireEvent.click(screen.getByTitle('Cancelar'))

      expect(screen.queryByDisplayValue('otro')).toBeNull()
      expect(screen.getByText('juan')).toBeInTheDocument()
      expect(api.put).not.toHaveBeenCalled()
    })

    it('guarda los cambios, avisa y recarga la lista', async () => {
      api.put.mockResolvedValue({ data: {} })
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[1])
      fireEvent.change(screen.getByDisplayValue('juan'), { target: { value: 'juan2' } })
      fireEvent.change(screen.getByDisplayValue('j@j.com'), { target: { value: 'nuevo@j.com' } })
      fireEvent.change(screen.getByDisplayValue('Jugador'), { target: { value: 'admin' } })
      fireEvent.click(screen.getByTitle('Guardar'))

      expect(await screen.findByText('Usuario actualizado correctamente')).toBeInTheDocument()
      expect(api.put).toHaveBeenCalledWith('/usuarios/2/', {
        username: 'juan2',
        email: 'nuevo@j.com',
        rol: 'admin',
      })
      expect(lista.reload).toHaveBeenCalledTimes(1)
      expect(screen.queryByTitle('Guardar')).toBeNull()
    })

    it('el aviso de éxito se quita solo a los 4 segundos', async () => {
      api.put.mockResolvedValue({ data: {} })
      const espia = vi.spyOn(globalThis, 'setTimeout')
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[1])
      fireEvent.click(screen.getByTitle('Guardar'))
      await screen.findByText('Usuario actualizado correctamente')

      const llamada = espia.mock.calls.find((c) => c[1] === 4000)
      expect(llamada).toBeDefined()
      act(() => llamada[0]())
      expect(screen.queryByText('Usuario actualizado correctamente')).toBeNull()
    })

    it('si el admin se edita a sí mismo, sincroniza el contexto', async () => {
      const actualizado = { id: 1, username: 'admin', rol: 'jugador' }
      api.put.mockResolvedValue({ data: { usuario: actualizado } })
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[0])
      fireEvent.click(screen.getByTitle('Guardar'))

      await screen.findByText('Usuario actualizado correctamente')
      expect(auth.current.updateUser).toHaveBeenCalledWith(actualizado)
    })

    it('si edita a otro usuario no toca el contexto', async () => {
      api.put.mockResolvedValue({ data: { usuario: { id: 2 } } })
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[1])
      fireEvent.click(screen.getByTitle('Guardar'))

      await screen.findByText('Usuario actualizado correctamente')
      expect(auth.current.updateUser).not.toHaveBeenCalled()
    })

    it('si el servidor no devuelve el usuario, tampoco toca el contexto', async () => {
      api.put.mockResolvedValue({ data: {} })
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[0])
      fireEvent.click(screen.getByTitle('Guardar'))

      await screen.findByText('Usuario actualizado correctamente')
      expect(auth.current.updateUser).not.toHaveBeenCalled()
    })

    it('un error del servidor muestra su mensaje y sigue en edición', async () => {
      api.put.mockRejectedValue({ response: { data: { detalle: 'Rol inválido' } } })
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[1])
      fireEvent.click(screen.getByTitle('Guardar'))

      expect(await screen.findByText('Rol inválido')).toBeInTheDocument()
      expect(screen.getByTitle('Guardar')).toBeInTheDocument()
      expect(lista.reload).not.toHaveBeenCalled()
    })

    it('un error sin detalle muestra el mensaje por defecto', async () => {
      api.put.mockRejectedValue(new Error('red'))
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[1])
      fireEvent.click(screen.getByTitle('Guardar'))

      expect(await screen.findByText('Error al actualizar')).toBeInTheDocument()
    })

    it('empezar a editar borra el aviso anterior', async () => {
      api.put.mockRejectedValue(new Error('red'))
      await abrirUsuarios()
      fireEvent.click(screen.getAllByTitle('Editar')[1])
      fireEvent.click(screen.getByTitle('Guardar'))
      await screen.findByText('Error al actualizar')

      fireEvent.click(screen.getByTitle('Cancelar'))
      fireEvent.click(screen.getAllByTitle('Editar')[1])
      expect(screen.queryByText('Error al actualizar')).toBeNull()
    })
  })

  describe('eliminar', () => {
    it('pide confirmación, elimina, avisa y recarga', async () => {
      api.delete.mockResolvedValue({})
      await abrirUsuarios()
      fireEvent.click(screen.getByTitle('Eliminar'))

      expect(await screen.findByText('Usuario desactivado')).toBeInTheDocument()
      expect(confirm).toHaveBeenCalledWith('¿Eliminar este usuario?')
      expect(api.delete).toHaveBeenCalledWith('/usuarios/2/')
      expect(lista.reload).toHaveBeenCalledTimes(1)
    })

    it('si el usuario cancela la confirmación no elimina nada', async () => {
      confirm.mockReturnValue(false)
      await abrirUsuarios()
      fireEvent.click(screen.getByTitle('Eliminar'))

      expect(api.delete).not.toHaveBeenCalled()
      expect(lista.reload).not.toHaveBeenCalled()
    })

    it('si falla muestra "Error al eliminar"', async () => {
      api.delete.mockRejectedValue(new Error('500'))
      await abrirUsuarios()
      fireEvent.click(screen.getByTitle('Eliminar'))

      expect(await screen.findByText('Error al eliminar')).toBeInTheDocument()
      expect(lista.reload).not.toHaveBeenCalled()
    })
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Admin - pestaña Niveles', () => {
  let lista

  beforeEach(() => {
    lista = hacerListado({ items: NIVELES, total: 3 })
    listados.current['/niveles/'] = lista
  })

  async function abrirNiveles() {
    renderAdmin()
    await screen.findByText('Mejor puntuación')
    irA('Niveles')
  }

  it('lista los niveles con dificultad, tiempo y total', async () => {
    await abrirNiveles()
    expect(screen.getByText('Isla')).toBeInTheDocument()
    expect(screen.getByText('Tormenta')).toBeInTheDocument()
    expect(screen.getByText('Marea')).toBeInTheDocument()
    expect(screen.getByText('120s')).toBeInTheDocument()
    expect(screen.getByText('60s')).toBeInTheDocument()
    expect(screen.getByText('-')).toBeInTheDocument() // Tormenta no tiene límite
    expect(screen.getByText('3 niveles configurados')).toBeInTheDocument()
  })

  it('el color del badge depende de la dificultad', async () => {
    await abrirNiveles()
    expect(screen.getByText('facil', { selector: 'span.fr-badge' }).className).toContain('fr-badge-easy')
    expect(screen.getByText('medio', { selector: 'span.fr-badge' }).className).toContain('fr-badge-medium')
    expect(screen.getByText('dificil', { selector: 'span.fr-badge' }).className).toContain('fr-badge-hard')
  })

  it('sin niveles avisa que no hay', async () => {
    listados.current['/niveles/'] = hacerListado()
    await abrirNiveles()
    expect(screen.getByText('No hay niveles creados')).toBeInTheDocument()
  })

  it('si la lista falla muestra "Error al cargar"', async () => {
    listados.current['/niveles/'] = hacerListado({ error: true })
    await abrirNiveles()
    expect(screen.getByText('Error al cargar')).toBeInTheDocument()
  })

  it('la paginación cambia de página', async () => {
    await abrirNiveles()
    fireEvent.click(screen.getByRole('button', { name: 'pagina-niveles' }))
    expect(lista.setPage).toHaveBeenCalledWith(2)
  })

  describe('crear', () => {
    async function abrirFormularioDeCreacion() {
      await abrirNiveles()
      fireEvent.click(screen.getByRole('button', { name: /Nuevo nivel/ }))
    }

    it('"Nuevo nivel" abre el formulario y "Cancelar" lo cierra', async () => {
      await abrirFormularioDeCreacion()
      expect(screen.getByPlaceholderText('Nombre del nivel')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(screen.queryByPlaceholderText('Nombre del nivel')).toBeNull()
      expect(screen.getByRole('button', { name: /Nuevo nivel/ })).toBeInTheDocument()
    })

    it('crea el nivel con el tiempo como número y recarga', async () => {
      api.post.mockResolvedValue({ data: {} })
      await abrirFormularioDeCreacion()
      fireEvent.change(screen.getByPlaceholderText('Nombre del nivel'), { target: { value: 'Cueva' } })
      fireEvent.change(screen.getByDisplayValue('Fácil'), { target: { value: 'medio' } })
      fireEvent.change(screen.getByPlaceholderText('Tiempo (seg)'), { target: { value: '90' } })
      fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

      await waitFor(() => expect(lista.reload).toHaveBeenCalledTimes(1))
      expect(api.post).toHaveBeenCalledWith('/niveles/', {
        nombre: 'Cueva',
        dificultad: 'medio',
        tiempo_limite: 90,
      })
      expect(screen.queryByPlaceholderText('Nombre del nivel')).toBeNull()
    })

    it('sin tiempo envía tiempo_limite null', async () => {
      api.post.mockResolvedValue({ data: {} })
      await abrirFormularioDeCreacion()
      fireEvent.change(screen.getByPlaceholderText('Nombre del nivel'), { target: { value: 'Cueva' } })
      fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

      await waitFor(() => expect(api.post).toHaveBeenCalled())
      expect(api.post.mock.calls[0][1]).toEqual({
        nombre: 'Cueva',
        dificultad: 'facil',
        tiempo_limite: null,
      })
    })

    it('si falla muestra "Error al crear" y deja el formulario abierto', async () => {
      api.post.mockRejectedValue(new Error('500'))
      await abrirFormularioDeCreacion()
      fireEvent.change(screen.getByPlaceholderText('Nombre del nivel'), { target: { value: 'Cueva' } })
      fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

      expect(await screen.findByText('Error al crear')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Nombre del nivel').value).toBe('Cueva')
      expect(lista.reload).not.toHaveBeenCalled()
    })
  })

  describe('editar', () => {
    it('al editar muestra los datos actuales', async () => {
      await abrirNiveles()
      fireEvent.click(screen.getAllByTitle('Editar')[0])

      expect(screen.getByDisplayValue('Isla')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Fácil')).toBeInTheDocument()
      expect(screen.getByDisplayValue('120')).toBeInTheDocument()
    })

    it('"Cancelar" descarta la edición', async () => {
      await abrirNiveles()
      fireEvent.click(screen.getAllByTitle('Editar')[0])
      fireEvent.change(screen.getByDisplayValue('Isla'), { target: { value: 'Otra' } })
      fireEvent.click(screen.getByTitle('Cancelar'))

      expect(screen.getByText('Isla')).toBeInTheDocument()
      expect(api.put).not.toHaveBeenCalled()
    })

    it('guarda los cambios y recarga', async () => {
      api.put.mockResolvedValue({ data: {} })
      await abrirNiveles()
      fireEvent.click(screen.getAllByTitle('Editar')[0])
      fireEvent.change(screen.getByDisplayValue('Isla'), { target: { value: 'Isla 2' } })
      fireEvent.change(screen.getByDisplayValue('Fácil'), { target: { value: 'dificil' } })
      fireEvent.change(screen.getByDisplayValue('120'), { target: { value: '200' } })
      fireEvent.click(screen.getByTitle('Guardar'))

      await waitFor(() => expect(lista.reload).toHaveBeenCalledTimes(1))
      expect(api.put).toHaveBeenCalledWith('/niveles/10/', {
        nombre: 'Isla 2',
        dificultad: 'dificil',
        tiempo_limite: 200,
      })
      expect(screen.queryByTitle('Guardar')).toBeNull()
    })

    it('un nivel sin tiempo se guarda con tiempo_limite null', async () => {
      api.put.mockResolvedValue({ data: {} })
      await abrirNiveles()
      fireEvent.click(screen.getAllByTitle('Editar')[1]) // Tormenta, sin tiempo
      fireEvent.click(screen.getByTitle('Guardar'))

      await waitFor(() => expect(api.put).toHaveBeenCalled())
      expect(api.put.mock.calls[0][0]).toBe('/niveles/11/')
      expect(api.put.mock.calls[0][1].tiempo_limite).toBeNull()
    })

    it('si falla muestra "Error al actualizar" y sigue en edición', async () => {
      api.put.mockRejectedValue(new Error('500'))
      await abrirNiveles()
      fireEvent.click(screen.getAllByTitle('Editar')[0])
      fireEvent.click(screen.getByTitle('Guardar'))

      expect(await screen.findByText('Error al actualizar')).toBeInTheDocument()
      expect(screen.getByTitle('Guardar')).toBeInTheDocument()
    })
  })

  describe('eliminar', () => {
    it('pide confirmación, elimina y recarga', async () => {
      api.delete.mockResolvedValue({})
      await abrirNiveles()
      fireEvent.click(screen.getAllByTitle('Eliminar')[0])

      await waitFor(() => expect(lista.reload).toHaveBeenCalledTimes(1))
      expect(confirm).toHaveBeenCalledWith('¿Eliminar este nivel?')
      expect(api.delete).toHaveBeenCalledWith('/niveles/10/')
    })

    it('si se cancela la confirmación no elimina', async () => {
      confirm.mockReturnValue(false)
      await abrirNiveles()
      fireEvent.click(screen.getAllByTitle('Eliminar')[0])

      expect(api.delete).not.toHaveBeenCalled()
    })

    it('si falla muestra "Error al eliminar"', async () => {
      api.delete.mockRejectedValue(new Error('500'))
      await abrirNiveles()
      fireEvent.click(screen.getAllByTitle('Eliminar')[0])

      expect(await screen.findByText('Error al eliminar')).toBeInTheDocument()
      expect(lista.reload).not.toHaveBeenCalled()
    })
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Admin - pestaña Partidas', () => {
  let lista

  beforeEach(() => {
    lista = hacerListado({ items: PARTIDAS, total: 3 })
    listados.current['/admin/partidas/'] = lista
    // El desplegable de niveles pide su propia lista.
    listados.current['/niveles/'] = hacerListado({ items: NIVELES, total: 3 })
  })

  async function abrirPartidas() {
    const resultado = renderAdmin()
    await screen.findByText('Mejor puntuación')
    irA('Partidas')
    return resultado
  }

  it('lista cada usuario una sola vez con sus puntos acumulados y mejor puntaje', async () => {
    const { container } = await abrirPartidas()
    // Solo la tabla: los desplegables también contienen esos nombres.
    const tbody = container.querySelector('tbody')
    ;['ana', 'luis', 'juan'].forEach((u) =>
      expect(within(tbody).getAllByText(u)).toHaveLength(1),
    )
    // ana 450+450, luis 700+700, juan 1350+900
    ;['450', '700', '1350', '900'].forEach((p) =>
      expect(screen.getAllByText(p).length).toBeGreaterThan(0),
    )
    expect(screen.getByText('3 jugadores')).toBeInTheDocument()
  })

  it('da formato m:ss al tiempo total y "-" si no hay', async () => {
    await abrirPartidas()
    expect(screen.getByText('3:25')).toBeInTheDocument() // 205 s
    expect(screen.getByText('0:59')).toBeInTheDocument() // 59 s
    expect(screen.getByText('-')).toBeInTheDocument() // sin tiempo
  })

  it('el desplegable lista los niveles y filtra el resumen', async () => {
    await abrirPartidas()
    const select = screen.getByLabelText('Filtrar por nivel')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Todos los niveles')).toBeInTheDocument()
    ;['Isla', 'Tormenta', 'Marea'].forEach((n) =>
      expect(screen.getByText(n)).toBeInTheDocument(),
    )

    fireEvent.change(select, { target: { value: '10' } })
    expect(paginada).toHaveBeenCalledWith('/admin/partidas/?nivel=10', 50)
  })

  it('la búsqueda por nombre filtra el resumen', async () => {
    await abrirPartidas()
    const input = screen.getByLabelText('Buscar jugador por nombre')
    fireEvent.change(input, { target: { value: 'ana' } })
    expect(paginada).toHaveBeenCalledWith('/admin/partidas/?nombre=ana', 50)
  })

  it('combina el filtro de nivel con la búsqueda', async () => {
    await abrirPartidas()
    fireEvent.change(screen.getByLabelText('Filtrar por nivel'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Buscar jugador por nombre'), { target: { value: 'ju' } })
    expect(paginada).toHaveBeenCalledWith('/admin/partidas/?nivel=10&nombre=ju', 50)
  })

  it('al filtrar vuelve a la página 1', async () => {
    await abrirPartidas()
    fireEvent.change(screen.getByLabelText('Buscar jugador por nombre'), { target: { value: 'x' } })
    expect(lista.setPage).toHaveBeenCalledWith(1)
  })

  it('al cambiar de nivel vuelve a la página 1', async () => {
    await abrirPartidas()
    fireEvent.change(screen.getByLabelText('Filtrar por nivel'), { target: { value: '11' } })
    expect(lista.setPage).toHaveBeenCalledWith(1)
  })

  it('sin partidas avisa que no hay', async () => {
    listados.current['/admin/partidas/'] = hacerListado()
    await abrirPartidas()
    expect(screen.getByText('No hay partidas registradas')).toBeInTheDocument()
  })

  it('mientras carga no muestra el aviso de vacío', async () => {
    listados.current['/admin/partidas/'] = hacerListado({ loading: true })
    await abrirPartidas()
    expect(screen.queryByText('No hay partidas registradas')).toBeNull()
  })

  it('si la lista falla muestra "Error al cargar"', async () => {
    listados.current['/admin/partidas/'] = hacerListado({ error: true })
    await abrirPartidas()
    expect(screen.getByText('Error al cargar')).toBeInTheDocument()
  })

  it('la paginación cambia de página', async () => {
    await abrirPartidas()
    fireEvent.click(screen.getByRole('button', { name: 'pagina-partidas' }))
    expect(lista.setPage).toHaveBeenCalledWith(2)
  })
})
