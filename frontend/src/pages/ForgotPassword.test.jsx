import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../components/ErrorMessage', () => ({
  default: ({ message }) => (message ? <div role="alert">{message}</div> : null),
}))

import API from '../api/axios'
import ForgotPassword from './ForgotPassword'

function renderConToken(url = '/recuperar?token=abc123') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ForgotPassword />
    </MemoryRouter>,
  )
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    API.get.mockReset()
    API.post.mockReset()
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

  it('con token solo CONSULTA el estado y NO confirma la identidad al montar', async () => {
    API.get.mockResolvedValue({ data: { confirmado: false } })
    renderConToken()

    expect(await screen.findByRole('heading', { name: '¿Eres Tú?' })).toBeInTheDocument()
    expect(API.get).toHaveBeenCalledWith('/password-reset/verificar/?token=abc123', expect.anything())
    expect(API.post).not.toHaveBeenCalled()
  })

  it('confirma solo cuando el usuario pulsa "Sí, soy yo"', async () => {
    API.get.mockResolvedValue({ data: { confirmado: false } })
    API.post.mockResolvedValue({ data: {} })
    renderConToken()

    fireEvent.click(await screen.findByRole('button', { name: 'Sí, soy yo' }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/password-reset/confirmar/', { token: 'abc123' }))
    expect(await screen.findByRole('heading', { name: 'Identidad Confirmada' })).toBeInTheDocument()
  })

  it('muestra el formulario de nueva contraseña si el token ya estaba confirmado', async () => {
    API.get.mockResolvedValue({ data: { confirmado: true } })
    renderConToken()

    expect(await screen.findByLabelText('Código de Verificación')).toBeInTheDocument()
    expect(API.post).not.toHaveBeenCalled()
  })

  it('un token caducado (GET rechazado) deja el botón de confirmación en pie', async () => {
    API.get.mockRejectedValue({ response: { status: 404 } })
    renderConToken('/recuperar?token=expirado')

    expect(await screen.findByRole('heading', { name: '¿Eres Tú?' })).toBeInTheDocument()
    expect(API.post).not.toHaveBeenCalled()
  })

  it('un enlace inválido al confirmar lleva al paso de enlace no válido', async () => {
    API.get.mockResolvedValue({ data: { confirmado: false } })
    API.post.mockRejectedValue({ response: { status: 400 } })
    renderConToken()

    fireEvent.click(await screen.findByRole('button', { name: 'Sí, soy yo' }))

    expect(await screen.findByRole('heading', { name: 'Enlace No Válido' })).toBeInTheDocument()
    expect(screen.getByText('El enlace no es válido o ha expirado. Solicita uno nuevo.')).toBeInTheDocument()
  })
})
