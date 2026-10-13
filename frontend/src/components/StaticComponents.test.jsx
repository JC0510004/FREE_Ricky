// ─── TESTS: componentes estáticos de la landing ───────────────────────
// Community, Footer, Manifesto y News casi no tienen lógica. Estos tests
// comprueban lo que sí puede romperse: que rendericen, que los enlaces
// apunten a donde deben y que las imágenes tengan texto alternativo.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Community usa useAuth para ocultar el botón de registro a usuarios con
// sesión. Se mockea el hook para no necesitar un AuthProvider real (que haría
// peticiones de red).
const authMock = vi.fn()
vi.mock('../contexts/useAuth', () => ({
  useAuth: () => authMock(),
}))

import Community from './Community'
import Footer from './Footer'
import Manifesto from './Manifesto'
import News from './News'

// Community y Footer usan <Link>, que necesita un Router alrededor.
function renderConRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('Community', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Por defecto, visitante sin sesión.
    authMock.mockReturnValue({ isAuthenticated: false })
  })

  it('muestra la etiqueta y el título de la sección', () => {
    renderConRouter(<Community />)
    expect(screen.getByText('COMUNIDAD')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: '¿CREES TENER MÁS SUERTE QUE ÉL??' })
    ).toBeTruthy()
  })

  it('el botón lleva a la página de registro', () => {
    renderConRouter(<Community />)
    const boton = screen.getByRole('link', { name: 'ÚNETE A LA TRIPULACIÓN' })
    expect(boton.getAttribute('href')).toBe('/register')
  })

  it('con sesión iniciada el botón lleva al juego', () => {
    authMock.mockReturnValue({ isAuthenticated: true })
    renderConRouter(<Community />)
    const boton = screen.getByRole('link', { name: 'ÚNETE A LA TRIPULACIÓN' })
    expect(boton.getAttribute('href')).toBe('/juego')
  })

  it('la sección tiene el id al que apunta el pie de página', () => {
    const { container } = renderConRouter(<Community />)
    expect(container.querySelector('section#community')).not.toBeNull()
  })
})

describe('Footer', () => {
  it('el logo lleva al inicio', () => {
    renderConRouter(<Footer />)
    const logo = screen.getByRole('link', { name: 'SALT BORN' })
    expect(logo.getAttribute('href')).toBe('/')
  })

  it.each([
    ['Actualizaciones', '#news'],
    ['Tripulación', '#team'],
    ['Comunidad', '#community'],
    ['Historia', '#manifesto'],
  ])('el enlace "%s" apunta a %s', (nombre, ancla) => {
    renderConRouter(<Footer />)
    expect(
      screen.getByRole('link', { name: nombre }).getAttribute('href')
    ).toBe(ancla)
  })

  it('muestra el copyright con el año actual', () => {
    renderConRouter(<Footer />)
    const anio = new Date().getFullYear()
    expect(
      screen.getByText(new RegExp(`${anio}, 1724 Studios`))
    ).toBeTruthy()
  })

  it.each([
    ['In', 'https://linkedin.com'],
    ['X', 'https://x.com'],
  ])('la red social "%s" abre %s en pestaña nueva y segura', (nombre, url) => {
    renderConRouter(<Footer />)
    const enlace = screen.getByRole('link', { name: nombre })
    expect(enlace.getAttribute('href')).toBe(url)
    expect(enlace.getAttribute('target')).toBe('_blank')
    // Sin noopener/noreferrer la página externa podría controlar la nuestra.
    expect(enlace.getAttribute('rel')).toContain('noopener')
    expect(enlace.getAttribute('rel')).toContain('noreferrer')
  })
})

describe('Manifesto', () => {
  it('muestra la etiqueta y el título de la historia', () => {
    render(<Manifesto />)
    expect(screen.getByText('HISTORIA')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'El Pirata Más Salado del Océano' })
    ).toBeTruthy()
  })

  it('cuenta la historia en sus tres párrafos', () => {
    render(<Manifesto />)
    expect(screen.getByText(/este viejo pirata ha perseguido/i)).toBeTruthy()
    expect(screen.getByText(/perdió un ojo y un pie/i)).toBeTruthy()
    expect(screen.getByText(/trampas troll, secretos ocultos/i)).toBeTruthy()
  })

  it('muestra los tres personajes con texto alternativo', () => {
    render(<Manifesto />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getByAltText('Bucanero')).toBeTruthy()
    expect(screen.getByAltText('Enemigo 1')).toBeTruthy()
    expect(screen.getByAltText('Marinero')).toBeTruthy()
  })

  it('escalona la animación de las imágenes', () => {
    render(<Manifesto />)
    expect(screen.getByAltText('Bucanero').style.animationDelay).toBe('0s')
    expect(screen.getByAltText('Enemigo 1').style.animationDelay).toBe('0.5s')
    expect(screen.getByAltText('Marinero').style.animationDelay).toBe('1s')
  })

  it('la sección tiene el id al que apunta el pie de página', () => {
    const { container } = render(<Manifesto />)
    expect(container.querySelector('section#manifesto')).not.toBeNull()
  })
})

describe('News', () => {
  it('muestra la etiqueta de la sección', () => {
    render(<News />)
    expect(screen.getByText('NOTICIAS')).toBeTruthy()
  })

  it('muestra las dos noticias con su título y texto', () => {
    render(<News />)
    expect(
      screen.getByRole('heading', { name: 'EL MAPA DEL TESORO ESTÁ COMPLETO' })
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        name: 'PRESENTANDO EL GALEÓN MULTIJUGADOR',
      })
    ).toBeTruthy()
    expect(screen.getByText(/última pieza del mapa/i)).toBeTruthy()
    expect(screen.getByText(/caos cooperativo/i)).toBeTruthy()
  })

  it('cada noticia tiene su imagen con texto alternativo y fuente', () => {
    render(<News />)
    const imagenes = screen.getAllByRole('img')
    expect(imagenes).toHaveLength(2)
    expect(screen.getByAltText('Playtest Screenshot')).toBeTruthy()
    expect(screen.getByAltText('multiplayerGif')).toBeTruthy()
    imagenes.forEach((img) => expect(img.getAttribute('src')).toBeTruthy())
  })

  it('la sección tiene el id al que apunta el pie de página', () => {
    const { container } = render(<News />)
    expect(container.querySelector('section#news')).not.toBeNull()
  })
})