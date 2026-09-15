import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('./ErrorMessage', () => ({
  default: ({ message }) => (message ? <div role="alert">{message}</div> : null),
}))

let loginMock
let navigateMock

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ login: loginMock }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import Login from './Login'

describe('Login', () => {
  beforeEach(() => {
    loginMock = vi.fn().mockResolvedValue({ usuario: {} })
    navigateMock = vi.fn()
  })

  it('renderiza título y campos del formulario', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Iniciar Sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Usuario o Correo')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument()
  })

  it('muestra error si el usuario está vacío', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))
    expect(await screen.findByText('El usuario es requerido')).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('muestra error si la contraseña está vacía', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Usuario o Correo'), { target: { value: 'testuser' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))
    expect(await screen.findByText('La contraseña es requerida')).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('invoca login y navega al home en caso de éxito', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Usuario o Correo'), { target: { value: 'testuser' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'TestPass123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('testuser', 'TestPass123!'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'))
  })

  it('muestra el error del backend si el login falla', async () => {
    loginMock.mockRejectedValue({ response: { data: { error: 'Cuenta bloqueada' } } })
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Usuario o Correo'), { target: { value: 'testuser' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    expect(await screen.findByText('Cuenta bloqueada')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('usa mensaje genérico si el error no tiene detalle', async () => {
    loginMock.mockRejectedValue(new Error('network error'))
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Usuario o Correo'), { target: { value: 'testuser' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    expect(await screen.findByText('Credenciales incorrectas')).toBeInTheDocument()
  })
})