// ─── TESTS: Hero, Team y LoadingScreen ────────────────────────────────
// Estos tres componentes sí tienen lógica: parallax con requestAnimationFrame,
// carrusel con teclado y temporizadores. jsdom no trae IntersectionObserver
// ni controla los frames, así que se simulan a mano.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Hero usa useAuth para decidir a dónde lleva su botón principal. Se mockea
// el hook para no necesitar un AuthProvider real (que haría peticiones de red).
const authMock = vi.fn()
vi.mock('../contexts/useAuth', () => ({
  useAuth: () => authMock(),
}))

import Hero from './Hero'
import Team from './Team'
import LoadingScreen from './LoadingScreen'

// ─── Simulacro de IntersectionObserver ────────────────────────────────
// Guarda cada observador creado para poder "mostrar" u "ocultar" la sección
// llamando a su callback a mano.
let observadores = []

class FalsoObserver {
  constructor(callback, opciones) {
    this.callback = callback
    this.opciones = opciones
    this.observe = vi.fn()
    this.disconnect = vi.fn()
    observadores.push(this)
  }
}

function mostrarSeccion(visible) {
  act(() => {
    observadores[0].callback([{ isIntersecting: visible }])
  })
}

beforeEach(() => {
  observadores = []
  vi.stubGlobal('IntersectionObserver', FalsoObserver)
  // Por defecto, visitante sin sesión.
  authMock.mockReturnValue({ isAuthenticated: false, user: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ══════════════════════════════════════════════════════════════════════
// HERO
// ══════════════════════════════════════════════════════════════════════
describe('Hero', () => {
  // Frames controlados a mano: requestAnimationFrame solo guarda el callback
  // y avanzarFrame() ejecuta los pendientes.
  let cola
  let siguienteId

  function avanzarFrame() {
    const pendientes = cola
    cola = []
    pendientes.forEach((f) => f.cb())
  }

  function moverMouseAlBordeDerechoInferior() {
    // clientX = ancho y clientY = alto  ->  posición normalizada 0.5 / 0.5
    window.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: window.innerWidth,
        clientY: window.innerHeight,
      })
    )
  }

  // Lee los píxeles del segundo translate(...) de la capa.
  function desplazamiento(img) {
    const m = img.style.transform.match(
      /translate\(\s*(-?[\d.e+-]+)px,\s*(-?[\d.e+-]+)px\)\s*$/
    )
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null
  }

  function renderHero() {
    return render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    cola = []
    siguienteId = 1
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb) => {
        const id = siguienteId++
        cola.push({ id, cb })
        return id
      })
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id) => {
        cola = cola.filter((f) => f.id !== id)
      })
    )
  })

  describe('contenido', () => {
    it('muestra el lema principal', () => {
      renderHero()
      const titulo = screen.getByRole('heading', { level: 1 })
      expect(titulo.textContent).toContain('EL TESORO ESTÁ AHÍ.')
      expect(titulo.textContent).toContain('LA SUERTE NO.')
    })

    it('cuenta la trama en dos párrafos', () => {
      renderHero()
      expect(screen.getByText(/un viejo pirata ha perseguido/i)).toBeTruthy()
      expect(screen.getByText(/ha encontrado la pista definitiva/i)).toBeTruthy()
    })

    it('el botón principal lleva al registro', () => {
      renderHero()
      const boton = screen.getByRole('link', { name: 'COMIENZA LA BÚSQUEDA' })
      expect(boton.getAttribute('href')).toBe('/register')
    })

    it('con sesión verificada el botón principal lleva al juego', () => {
      authMock.mockReturnValue({ isAuthenticated: true, user: { is_verified: true } })
      renderHero()
      const boton = screen.getByRole('link', { name: 'COMIENZA LA BÚSQUEDA' })
      expect(boton.getAttribute('href')).toBe('/juego')
    })

    it('con sesión sin verificar el botón principal queda apagado', () => {
      authMock.mockReturnValue({ isAuthenticated: true, user: { is_verified: false } })
      renderHero()
      const boton = screen.getByRole('button', { name: 'COMIENZA LA BÚSQUEDA' })
      expect(boton.disabled).toBe(true)
      expect(screen.queryByRole('link', { name: 'COMIENZA LA BÚSQUEDA' })).toBeNull()
    })

    it('tiene las cinco capas con su velocidad', () => {
      renderHero()
      const velocidades = {
        Background: '0.2',
        Sun: '0.5',
        Clouds: '1',
        Boat: '2',
        Sea: '3',
      }
      expect(screen.getAllByRole('img')).toHaveLength(5)
      Object.entries(velocidades).forEach(([alt, velocidad]) => {
        expect(screen.getByAltText(alt).getAttribute('data-speed')).toBe(velocidad)
      })
    })

    it('la sección tiene el id "hero"', () => {
      const { container } = renderHero()
      expect(container.querySelector('section#hero')).not.toBeNull()
    })
  })

  describe('parallax', () => {
    it('al montar centra cada capa sin desplazarla', () => {
      renderHero()
      const barco = screen.getByAltText('Boat')
      expect(barco.style.transform).toContain('translate(-50%, -50%)')
      expect(desplazamiento(barco)).toEqual([0, 0])
    })

    it('mueve las capas hacia el mouse de forma suave (un frame = 5%)', () => {
      renderHero()
      moverMouseAlBordeDerechoInferior()
      avanzarFrame()

      // posición suavizada = 0.5 * 0.05 = 0.025; barco: speed 2
      const [x, y] = desplazamiento(screen.getByAltText('Boat'))
      expect(x).toBeCloseTo(0.025 * 2 * 75, 5)
      expect(y).toBeCloseTo(0.025 * 2 * 50, 5)
    })

    it('las capas con más velocidad se mueven más', () => {
      renderHero()
      moverMouseAlBordeDerechoInferior()
      avanzarFrame()

      const [xFondo] = desplazamiento(screen.getByAltText('Background'))
      const [xNubes] = desplazamiento(screen.getByAltText('Clouds'))
      const [xMar] = desplazamiento(screen.getByAltText('Sea'))
      expect(xFondo).toBeLessThan(xNubes)
      expect(xNubes).toBeLessThan(xMar)
      // el mar (3) se mueve el triple que las nubes (1)
      expect(xMar / xNubes).toBeCloseTo(3, 5)
    })

    it('programa un frame nuevo en cada ciclo', () => {
      renderHero()
      expect(cola).toHaveLength(1)
      avanzarFrame()
      expect(cola).toHaveLength(1)
    })

    it('cuando el mouse sale de la ventana las capas regresan al centro', () => {
      renderHero()
      moverMouseAlBordeDerechoInferior()
      avanzarFrame()
      const [antes] = desplazamiento(screen.getByAltText('Boat'))

      document.dispatchEvent(new Event('mouseleave'))
      avanzarFrame()
      const [despues] = desplazamiento(screen.getByAltText('Boat'))
      expect(despues).toBeLessThan(antes)

      for (let i = 0; i < 300; i++) avanzarFrame()
      const [final] = desplazamiento(screen.getByAltText('Boat'))
      expect(final).toBeCloseTo(0, 2)
    })
  })

  describe('optimización con IntersectionObserver', () => {
    it('observa la sección del hero', () => {
      const { container } = renderHero()
      expect(observadores).toHaveLength(1)
      expect(observadores[0].observe).toHaveBeenCalledWith(
        container.querySelector('section#hero')
      )
    })

    it('deja de animar cuando la sección sale de pantalla', () => {
      renderHero()
      mostrarSeccion(false)
      avanzarFrame() // el frame pendiente detecta la pausa y no programa otro
      expect(cola).toHaveLength(0)
    })

    it('retoma la animación cuando la sección vuelve a verse', () => {
      renderHero()
      mostrarSeccion(false)
      avanzarFrame()
      expect(cola).toHaveLength(0)

      mostrarSeccion(true)
      expect(cola).toHaveLength(1)
    })

    it('no duplica el bucle si ya estaba animando', () => {
      renderHero()
      mostrarSeccion(true)
      mostrarSeccion(true)
      expect(cola).toHaveLength(1)
    })
  })

  describe('limpieza al desmontar', () => {
    it('cancela el frame, desconecta el observer y deja de escuchar el mouse', () => {
      const { unmount } = renderHero()
      const quitar = vi.spyOn(window, 'removeEventListener')

      unmount()

      expect(cancelAnimationFrame).toHaveBeenCalled()
      expect(observadores[0].disconnect).toHaveBeenCalled()
      expect(quitar).toHaveBeenCalledWith('pointermove', expect.any(Function))
      expect(cola).toHaveLength(0)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════
// TEAM
// ══════════════════════════════════════════════════════════════════════
describe('Team', () => {
  const MIEMBROS = [
    ['Marinero Valiente', 'Desarrollador Principal', 'source/img/team/BaldPirate.png'],
    ['Bucanero Furioso', 'Artista de Gráficos', 'source/img/team/bigGuy.png'],
    ['Enemigo Misterioso', 'Diseñador de Mecánicas', 'source/img/team/BombGuy.png'],
    ['Navegante Sabio', 'Director de Producción', 'source/img/team/Captain.png'],
    ['Capitán Ingeniero', 'Líder Técnico', 'source/img/team/Cucumber.png'],
    ['Capitán Barba Gris', 'Director Creativo', 'source/img/team/While.png'],
  ]

  // Altura "falsa": por defecto el largo del texto; se puede fijar a mano.
  let alturaFalsa

  const siguiente = () => screen.getByRole('button', { name: 'chevron_right' })
  const anterior = () => screen.getByRole('button', { name: 'chevron_left' })
  const contador = (container) =>
    container
      .querySelector('.team-member-counter')
      .textContent.replace(/\s+/g, ' ')
      .trim()
  const alturaMinima = () =>
    document.documentElement.style.getPropertyValue('--team-description-min-height')

  beforeEach(() => {
    alturaFalsa = null
    document.documentElement.style.removeProperty('--team-description-min-height')
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return alturaFalsa ?? this.textContent.length
      },
    })
  })

  afterEach(() => {
    delete HTMLElement.prototype.scrollHeight
  })

  describe('carrusel', () => {
    it('empieza en el primer miembro', () => {
      const { container } = render(<Team />)
      expect(screen.getByRole('heading', { name: 'Marinero Valiente' })).toBeTruthy()
      expect(screen.getByText('Desarrollador Principal')).toBeTruthy()
      expect(contador(container)).toBe('1 / 6')
    })

    it('muestra título y etiqueta de la sección', () => {
      render(<Team />)
      expect(screen.getByText('NUESTRO EQUIPO')).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'CONOCE A LA TRIPULACIÓN' })).toBeTruthy()
    })

    it('recorre los seis miembros con "siguiente" y da la vuelta', () => {
      const { container } = render(<Team />)

      MIEMBROS.forEach(([nombre, rol, imagen], i) => {
        expect(screen.getByRole('heading', { name: nombre })).toBeTruthy()
        expect(screen.getByText(rol)).toBeTruthy()
        expect(screen.getByAltText('team-img').getAttribute('src')).toBe(imagen)
        expect(contador(container)).toBe(`${i + 1} / 6`)
        fireEvent.click(siguiente())
      })

      // después del último vuelve al primero
      expect(screen.getByRole('heading', { name: 'Marinero Valiente' })).toBeTruthy()
      expect(contador(container)).toBe('1 / 6')
    })

    it('"anterior" desde el primero salta al último', () => {
      const { container } = render(<Team />)
      fireEvent.click(anterior())
      expect(screen.getByRole('heading', { name: 'Capitán Barba Gris' })).toBeTruthy()
      expect(contador(container)).toBe('6 / 6')
    })

    it('"anterior" retrocede un miembro', () => {
      render(<Team />)
      fireEvent.click(siguiente())
      fireEvent.click(siguiente())
      fireEvent.click(anterior())
      expect(screen.getByRole('heading', { name: 'Bucanero Furioso' })).toBeTruthy()
    })

    it('la descripción cambia junto con el miembro', () => {
      render(<Team />)
      expect(screen.getByText(/experto en construir sistemas robustos/i)).toBeTruthy()
      fireEvent.click(siguiente())
      expect(screen.getByText(/Especialista en crear mundos visuales/i)).toBeTruthy()
      expect(screen.queryByText(/experto en construir sistemas robustos/i)).toBeNull()
    })
  })

  describe('teclado (solo con la sección visible)', () => {
    it('observa la sección #team con umbral 0.1', () => {
      const { container } = render(<Team />)
      expect(observadores[0].observe).toHaveBeenCalledWith(
        container.querySelector('section#team')
      )
      expect(observadores[0].opciones).toEqual({ threshold: 0.1 })
    })

    it('ignora las flechas mientras la sección no está visible', () => {
      const { container } = render(<Team />)
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(contador(container)).toBe('1 / 6')
    })

    it('con la sección visible, → avanza y ← retrocede', () => {
      const { container } = render(<Team />)
      mostrarSeccion(true)

      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(contador(container)).toBe('2 / 6')

      fireEvent.keyDown(document, { key: 'ArrowLeft' })
      expect(contador(container)).toBe('1 / 6')
    })

    it('ignora otras teclas', () => {
      const { container } = render(<Team />)
      mostrarSeccion(true)
      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'a' })
      expect(contador(container)).toBe('1 / 6')
    })

    it('deja de responder cuando la sección sale de pantalla', () => {
      const { container } = render(<Team />)
      mostrarSeccion(true)
      mostrarSeccion(false)
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(contador(container)).toBe('1 / 6')
    })

    it('al desmontar desconecta el observer y quita el listener de teclado', () => {
      const { unmount } = render(<Team />)
      mostrarSeccion(true)
      const quitar = vi.spyOn(document, 'removeEventListener')

      unmount()

      expect(observadores[0].disconnect).toHaveBeenCalled()
      expect(quitar).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })

  describe('altura mínima de la descripción', () => {
    it('usa la descripción más larga como altura mínima', () => {
      render(<Team />)

      // La más larga es la del último miembro: se lee su largo real.
      fireEvent.click(anterior())
      const masLarga = screen.getByText(/Construir grandes equipos/i).textContent.length

      expect(alturaMinima()).toBe(`${masLarga}px`)
    })

    it('no deja elementos de medición sueltos en la página', () => {
      render(<Team />)
      expect(document.body.querySelectorAll('p[style*="hidden"]')).toHaveLength(0)
    })

    it('recalcula al cambiar el tamaño de la ventana, con 150 ms de espera', () => {
      vi.useFakeTimers()
      render(<Team />)
      const inicial = alturaMinima()

      alturaFalsa = 999
      fireEvent(window, new Event('resize'))
      act(() => vi.advanceTimersByTime(149))
      expect(alturaMinima()).toBe(inicial)

      act(() => vi.advanceTimersByTime(1))
      expect(alturaMinima()).toBe('999px')
    })

    it('varios resize seguidos solo recalculan una vez (debounce)', () => {
      vi.useFakeTimers()
      render(<Team />)
      const inicial = alturaMinima()

      alturaFalsa = 777
      fireEvent(window, new Event('resize'))
      act(() => vi.advanceTimersByTime(100))
      fireEvent(window, new Event('resize')) // reinicia la espera
      act(() => vi.advanceTimersByTime(100))
      expect(alturaMinima()).toBe(inicial)

      act(() => vi.advanceTimersByTime(50))
      expect(alturaMinima()).toBe('777px')
    })

    it('al desmontar cancela el recálculo pendiente', () => {
      vi.useFakeTimers()
      const { unmount } = render(<Team />)
      const inicial = alturaMinima()

      alturaFalsa = 555
      fireEvent(window, new Event('resize'))
      unmount()
      act(() => vi.advanceTimersByTime(500))

      expect(alturaMinima()).toBe(inicial)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════
// LOADING SCREEN
// ══════════════════════════════════════════════════════════════════════
describe('LoadingScreen', () => {
  const pantalla = () => document.getElementById('loading-screen')

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.classList.remove('loading-lock')
  })

  it('muestra el mensaje, el logo y los tres puntos animados', () => {
    const { container } = render(<LoadingScreen />)
    expect(screen.getByRole('heading', { name: 'PREPARING FOR IMMERSION' })).toBeTruthy()
    expect(screen.getByAltText('Loading Anchor')).toBeTruthy()

    const puntos = container.querySelectorAll('.loading-dots .dot')
    expect(puntos).toHaveLength(3)
    expect([...puntos].map((p) => p.style.animationDelay)).toEqual(['0s', '0.15s', '0.3s'])
  })

  it('al montar bloquea el scroll y la pantalla está visible', () => {
    render(<LoadingScreen />)
    expect(document.body.classList.contains('loading-lock')).toBe(true)
    expect(pantalla().classList.contains('hidden')).toBe(false)
  })

  it('a los 2500 ms oculta la pantalla y desbloquea el scroll', () => {
    render(<LoadingScreen />)

    act(() => vi.advanceTimersByTime(2499))
    expect(pantalla().classList.contains('hidden')).toBe(false)
    expect(document.body.classList.contains('loading-lock')).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(pantalla().classList.contains('hidden')).toBe(true)
    expect(document.body.classList.contains('loading-lock')).toBe(false)
  })

  it('avisa al padre a los 3500 ms, una sola vez', () => {
    const onFinished = vi.fn()
    render(<LoadingScreen onFinished={onFinished} />)

    act(() => vi.advanceTimersByTime(3499))
    expect(onFinished).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onFinished).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(10000))
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it('funciona sin onFinished (no lanza error)', () => {
    render(<LoadingScreen />)
    expect(() => act(() => vi.advanceTimersByTime(5000))).not.toThrow()
  })

  it('si se desmonta antes de tiempo, libera el scroll y no avisa al padre', () => {
    const onFinished = vi.fn()
    const { unmount } = render(<LoadingScreen onFinished={onFinished} />)
    expect(document.body.classList.contains('loading-lock')).toBe(true)

    unmount()
    expect(document.body.classList.contains('loading-lock')).toBe(false)

    act(() => vi.advanceTimersByTime(10000))
    expect(onFinished).not.toHaveBeenCalled()
  })
})