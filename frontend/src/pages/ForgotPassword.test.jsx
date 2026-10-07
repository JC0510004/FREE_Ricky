import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { loginWithResponseMock } = vi.hoisted(() => ({ loginWithResponseMock: vi.fn() }))

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../components/ErrorMessage', () => ({
  default: ({ message }) => (message ? <div role="alert">{message}</div> : null),
}))

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ loginWithResponse: loginWithResponseMock }),
}))

import API from '../api/axios'
import ForgotPassword from './ForgotPassword'

const PASSWORD = 'Abcdef1!'

function renderConToken(url = '/recuperar?token=abc123') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ForgotPassword />
    </MemoryRouter>,
  )
}

function rellenarFormulario() {
  fireEvent.change(screen.getByLabelText('Código de Verificación'), { target: { value: '123456' } })
  fireEvent.change(screen.getByLabelText('Nueva Contraseña'), { target: { value: PASSWORD } })
  fireEvent.change(screen.getByLabelText('Confirmar Contraseña'), { target: { value: PASSWORD } })
  fireEvent.click(screen.getByRole('button', { name: 'Restablecer Contraseña' }))
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    API.get.mockReset()
    API.post.mockReset()
    loginWithResponseMock.mockReset()
    // Igual que en la app: la sesión solo se abre si el backend trae credenciales.
    loginWithResponseMock.mockImplementation((data) => (data?.access_token ? data : null))
    localStorage.clear()
  })

  it('sin token en la URL muestra el formulario de correo', () => {
    render(
      <MemoryRouter initialEntries={['/recuperar']}>
        <ForgotPassword />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('Correo Electrónico')).toBeInTheDocument()
    expect(API.get).not.toHaveBeenCalled()
    expect(API.post).not.toHaveBeenCalled()
  })

  it('con token confirma la identidad al cargar y abre el formulario directamente', async () => {
    API.post.mockResolvedValue({ data: {} })
    renderConToken()

    expect(await screen.findByLabelText('Código de Verificación')).toBeInTheDocument()
    expect(API.post).toHaveBeenCalledWith('/password-reset/confirmar/', { token: 'abc123' }, expect.anything())
    // Ni "¿Eres Tú?" ni "Sí, soy yo": el enlace ya lo hizo el usuario.
    expect(screen.queryByRole('button', { name: 'Sí, soy yo' })).toBeNull()
    expect(screen.queryByRole('heading', { name: '¿Eres Tú?' })).toBeNull()
  })

  it('un token ya confirmado de antes también abre el formulario', async () => {
    API.post.mockRejectedValue({ response: { status: 400 } })
    API.get.mockResolvedValue({ data: { confirmado: true } })
    renderConToken()

    expect(await screen.findByLabelText('Código de Verificación')).toBeInTheDocument()
  })

  it('un enlace inválido muestra el paso de enlace no válido', async () => {
    API.post.mockRejectedValue({ response: { status: 400 } })
    API.get.mockRejectedValue({ response: { status: 404 } })
    renderConToken('/recuperar?token=expirado')

    expect(await screen.findByRole('heading', { name: 'Enlace No Válido' })).toBeInTheDocument()
    expect(screen.getByText('El enlace no es válido o ha expirado. Solicita uno nuevo.')).toBeInTheDocument()
  })

  it('al restablecer abre sesión y el final entra al juego', async () => {
    const payload = { mensaje: 'ok', usuario: { id: 1, username: 'juanc' }, access_token: 'tok' }
    API.post.mockImplementation((url) => {
      if (url === '/password-reset/confirmar/') return Promise.resolve({ data: {} })
      if (url === '/password-reset/verificar-codigo/') return Promise.resolve({ data: { valido: true } })
      if (url === '/password-reset/confirm/') return Promise.resolve({ data: payload })
      return Promise.reject(new Error(`url inesperada: ${url}`))
    })
    renderConToken()

    expect(await screen.findByLabelText('Código de Verificación')).toBeInTheDocument()
    rellenarFormulario()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Contraseña Restablecida' })).toBeInTheDocument())
    expect(loginWithResponseMock).toHaveBeenCalledWith(payload)
    expect(screen.getByRole('button', { name: 'Jugar ahora' })).toBeInTheDocument()
  })

  it('si el backend no emite credenciales, el final lleva al login', async () => {
    API.post.mockImplementation((url) => {
      if (url === '/password-reset/confirmar/') return Promise.resolve({ data: {} })
      if (url === '/password-reset/verificar-codigo/') return Promise.resolve({ data: { valido: true } })
      if (url === '/password-reset/confirm/') return Promise.resolve({ data: { mensaje: 'ok' } })
      return Promise.reject(new Error(`url inesperada: ${url}`))
    })
    renderConToken()

    expect(await screen.findByLabelText('Código de Verificación')).toBeInTheDocument()
    rellenarFormulario()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Contraseña Restablecida' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument()
  })
})
