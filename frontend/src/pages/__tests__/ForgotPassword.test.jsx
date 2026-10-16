import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter ,Routes, Route } from 'react-router-dom'

const { loginWithResponseMock } = vi.hoisted(() => ({ loginWithResponseMock: vi.fn() }))

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../../components/ErrorMessage', () => ({
  default: ({ message }) => (message ? <div role="alert">{message}</div> : null),
}))

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ loginWithResponse: loginWithResponseMock }),
}))

import API from '../../api/axios'
import ForgotPassword from '../ForgotPassword'

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
    expect(screen.getByRole('button', { name: 'Ir al inicio' })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Ir al inicio' })).toBeInTheDocument()
  })
  // ═══════════════════════════════════════════════════════════════════
  // PRUEBAS NUEVAS (pegar justo ANTES del último "})" del describe)
  // Reutilizan tus mocks (API, ErrorMessage, useAuth) y la constante PASSWORD.
  // ═══════════════════════════════════════════════════════════════════

  // Con rutas reales para poder comprobar a dónde navega la página.
  function renderEnRutas(url = '/recuperar') {
    return render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/recuperar" element={<ForgotPassword />} />
          <Route path="/login" element={<div>PAGINA LOGIN</div>} />
          <Route path="/" element={<div>PAGINA INICIO</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  // Cada paso del backend se puede reemplazar; por defecto todo sale bien.
  function simularApi({ solicitar, confirmar, codigo, confirm } = {}) {
    API.post.mockImplementation((url) => {
      if (url === '/password-reset/') return solicitar ? solicitar() : Promise.resolve({ data: {} })
      if (url === '/password-reset/confirmar/') return confirmar ? confirmar() : Promise.resolve({ data: {} })
      if (url === '/password-reset/verificar-codigo/') return codigo ? codigo() : Promise.resolve({ data: { valido: true } })
      if (url === '/password-reset/confirm/') return confirm ? confirm() : Promise.resolve({ data: { mensaje: 'ok' } })
      return Promise.reject(new Error(`url inesperada: ${url}`))
    })
  }

  const falla = (data, status = 400) => () => Promise.reject({ response: { status, data } })

  // ─── Paso 1: formulario de correo ───
  async function abrirFormularioDeCorreo(opciones) {
    simularApi(opciones)
    renderEnRutas('/recuperar')
    await screen.findByLabelText('Correo Electrónico')
  }
  const escribirCorreo = (valor) =>
    fireEvent.change(screen.getByLabelText('Correo Electrónico'), { target: { value: valor } })
  const enviarCorreo = () => fireEvent.click(screen.getByRole('button', { name: 'Enviar Enlace' }))

  // ─── Paso final: formulario de nueva contraseña ───
  async function abrirFormularioDeReset(opciones) {
    simularApi(opciones)
    renderEnRutas('/recuperar?token=abc123')
    await screen.findByLabelText('Código de Verificación')
  }
  function escribirReset({ codigo = '123456', password = PASSWORD, repetir = PASSWORD } = {}) {
    fireEvent.change(screen.getByLabelText('Código de Verificación'), { target: { value: codigo } })
    fireEvent.change(screen.getByLabelText('Nueva Contraseña'), { target: { value: password } })
    fireEvent.change(screen.getByLabelText('Confirmar Contraseña'), { target: { value: repetir } })
  }
  const enviarReset = () => fireEvent.click(screen.getByRole('button', { name: 'Restablecer Contraseña' }))

  describe('paso 1: pedir el enlace por correo', () => {
    it('un correo vacío muestra error y no llama a la API', async () => {
      await abrirFormularioDeCorreo()
      enviarCorreo()
      expect(screen.getByText('El correo es requerido')).toBeInTheDocument()
      expect(API.post).not.toHaveBeenCalled()
    })

    it.each([['no-es-correo'], ['juan@'], ['juan@correo']])(
      'el correo "%s" no es válido',
      async (correo) => {
        await abrirFormularioDeCorreo()
        escribirCorreo(correo)
        enviarCorreo()
        expect(screen.getByText('Debe ser un correo electrónico válido')).toBeInTheDocument()
        expect(API.post).not.toHaveBeenCalled()
      },
    )

    it('quita < y >, pasa a minúsculas y envía el correo limpio', async () => {
      await abrirFormularioDeCorreo()
      escribirCorreo('<JUAN@Correo.COM>')
      enviarCorreo()

      expect(await screen.findByRole('heading', { name: 'Correo Enviado' })).toBeInTheDocument()
      expect(API.post).toHaveBeenCalledWith('/password-reset/', { email: 'juan@correo.com' })
    })

    it('tras enviar, "Volver al inicio de sesión" lleva al login', async () => {
      await abrirFormularioDeCorreo()
      escribirCorreo('juan@correo.com')
      enviarCorreo()
      await screen.findByRole('heading', { name: 'Correo Enviado' })

      fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio de sesión' }))
      expect(screen.getByText('PAGINA LOGIN')).toBeInTheDocument()
    })

    it.each([
      ['errores del campo email', { errores: { email: ['Correo no registrado'] } }, 'Correo no registrado'],
      ['campo "error"', { error: 'Demasiados intentos' }, 'Demasiados intentos'],
      ['campo "detail"', { detail: 'No autorizado' }, 'No autorizado'],
      ['sin detalle', {}, 'Error al procesar la solicitud'],
    ])('error del servidor (%s) -> "%s"', async (_nombre, data, mensaje) => {
      await abrirFormularioDeCorreo({ solicitar: falla(data) })
      escribirCorreo('juan@correo.com')
      enviarCorreo()

      expect(await screen.findByText(mensaje)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Enviar Enlace' }).disabled).toBe(false)
    })

    it('mientras envía bloquea el botón y el campo', async () => {
      let resolver
      await abrirFormularioDeCorreo({ solicitar: () => new Promise((r) => { resolver = r }) })
      escribirCorreo('juan@correo.com')
      enviarCorreo()

      const boton = await screen.findByRole('button', { name: 'Enviando...' })
      expect(boton.disabled).toBe(true)
      expect(screen.getByLabelText('Correo Electrónico').disabled).toBe(true)

      resolver({ data: {} })
      expect(await screen.findByRole('heading', { name: 'Correo Enviado' })).toBeInTheDocument()
    })

    it('el logo y el enlace de volver llevan a su página', async () => {
      await abrirFormularioDeCorreo()
      fireEvent.click(screen.getByRole('link', { name: 'Volver al inicio de sesión' }))
      expect(screen.getByText('PAGINA LOGIN')).toBeInTheDocument()
    })

    it('el logo lleva al inicio', async () => {
      await abrirFormularioDeCorreo()
      fireEvent.click(screen.getByRole('link', { name: 'SALT BORN' }))
      expect(screen.getByText('PAGINA INICIO')).toBeInTheDocument()
    })
  })

  describe('apertura del enlace', () => {
    it('mientras confirma el token muestra "Abriendo tu enlace"', () => {
      API.post.mockImplementation(() => new Promise(() => {}))
      renderEnRutas('/recuperar?token=abc123')
      expect(screen.getByRole('heading', { name: 'Abriendo tu enlace' })).toBeInTheDocument()
    })

    it('si el token no está confirmado, el enlace no es válido', async () => {
      API.post.mockRejectedValue({ response: { status: 400 } })
      API.get.mockResolvedValue({ data: { confirmado: false } })
      renderEnRutas('/recuperar?token=expirado')

      expect(await screen.findByRole('heading', { name: 'Enlace No Válido' })).toBeInTheDocument()
      expect(screen.getByText('El enlace no es válido o ha expirado. Solicita uno nuevo.')).toBeInTheDocument()
      expect(API.get.mock.calls[0][0]).toBe('/password-reset/verificar/?token=expirado')
    })

    it('"Solicitar un enlace nuevo" vuelve al formulario de correo', async () => {
      API.post.mockRejectedValue({ response: { status: 400 } })
      API.get.mockRejectedValue({ response: { status: 404 } })
      renderEnRutas('/recuperar?token=expirado')

      fireEvent.click(await screen.findByRole('button', { name: 'Solicitar un enlace nuevo' }))

      expect(screen.getByLabelText('Correo Electrónico').value).toBe('')
      expect(screen.queryByText('El enlace no es válido o ha expirado. Solicita uno nuevo.')).toBeNull()
    })

    it('si la petición se cancela (ERR_CANCELED) no consulta el estado ni muestra error', async () => {
      API.post.mockRejectedValue({ code: 'ERR_CANCELED' })
      renderEnRutas('/recuperar?token=abc123')
      await new Promise((r) => setTimeout(r, 0))

      expect(API.get).not.toHaveBeenCalled()
      expect(screen.getByRole('heading', { name: 'Abriendo tu enlace' })).toBeInTheDocument()
    })

    it('si se desmonta antes de la respuesta no consulta el estado', async () => {
      let rechazar
      API.post.mockImplementation(() => new Promise((_, rej) => { rechazar = rej }))
      const { unmount } = renderEnRutas('/recuperar?token=abc123')

      unmount()
      rechazar({ response: { status: 400 } })
      await new Promise((r) => setTimeout(r, 0))

      expect(API.get).not.toHaveBeenCalled()
    })
  })

  describe('paso final: validación de código y contraseña', () => {
    it.each([
      ['código incompleto', { codigo: '123' }, 'El código debe ser de 6 dígitos'],
      ['código vacío', { codigo: '' }, 'El código debe ser de 6 dígitos'],
      ['contraseña corta', { password: 'Ab1!', repetir: 'Ab1!' }, 'Mínimo 8 caracteres'],
      ['sin mayúscula', { password: 'abcdef1!', repetir: 'abcdef1!' }, 'Debe tener una mayúscula'],
      ['sin minúscula', { password: 'ABCDEF1!', repetir: 'ABCDEF1!' }, 'Debe tener una minúscula'],
      ['sin número', { password: 'Abcdefg!', repetir: 'Abcdefg!' }, 'Debe tener un número'],
      ['sin carácter especial', { password: 'Abcdefg1', repetir: 'Abcdefg1' }, 'Debe tener un carácter especial'],
      ['no coinciden', { repetir: 'Otra1234!' }, 'Las contraseñas no coinciden'],
    ])('%s -> "%s" y no llama al backend', async (_nombre, campos, mensaje) => {
      await abrirFormularioDeReset()
      escribirReset(campos)
      enviarReset()

      expect(screen.getByText(mensaje)).toBeInTheDocument()
      // Solo la confirmación inicial del enlace; nada más.
      expect(API.post).toHaveBeenCalledTimes(1)
    })

    it('el campo del código solo acepta dígitos y como máximo 6', async () => {
      await abrirFormularioDeReset()
      const campo = screen.getByLabelText('Código de Verificación')

      fireEvent.change(campo, { target: { value: 'ab12cd34' } })
      expect(campo.value).toBe('1234')

      fireEvent.change(campo, { target: { value: '12345678' } })
      expect(campo.value).toBe('123456')
    })

    it('cada botón alterna solo su propio campo de contraseña', async () => {
      await abrirFormularioDeReset()
      const nueva = screen.getByLabelText('Nueva Contraseña')
      const confirmacion = screen.getByLabelText('Confirmar Contraseña')
      const [botonNueva, botonConfirmacion] = screen.getAllByRole('button', { name: 'Mostrar' })

      expect(nueva.getAttribute('type')).toBe('password')
      fireEvent.click(botonNueva)
      expect(nueva.getAttribute('type')).toBe('text')
      expect(confirmacion.getAttribute('type')).toBe('password')

      fireEvent.click(botonConfirmacion)
      expect(confirmacion.getAttribute('type')).toBe('text')

      fireEvent.click(botonNueva)
      expect(nueva.getAttribute('type')).toBe('password')
    })
  })

  describe('paso final: respuestas del servidor', () => {
    it('un código inválido muestra el error y no cambia la contraseña', async () => {
      await abrirFormularioDeReset({ codigo: () => Promise.resolve({ data: { valido: false } }) })
      escribirReset()
      enviarReset()

      expect(await screen.findByText('Código de verificación inválido')).toBeInTheDocument()
      expect(API.post).not.toHaveBeenCalledWith('/password-reset/confirm/', expect.anything())
      expect(screen.getByRole('button', { name: 'Restablecer Contraseña' }).disabled).toBe(false)
    })

    it('si la verificación no trae "valido" también se rechaza', async () => {
      await abrirFormularioDeReset({ codigo: () => Promise.resolve({ data: {} }) })
      escribirReset()
      enviarReset()

      expect(await screen.findByText('Código de verificación inválido')).toBeInTheDocument()
    })

    it('envía token, código y contraseña en los dos pasos', async () => {
      await abrirFormularioDeReset()
      escribirReset()
      enviarReset()

      await screen.findByRole('heading', { name: 'Contraseña Restablecida' })
      expect(API.post).toHaveBeenCalledWith('/password-reset/verificar-codigo/', {
        token: 'abc123',
        codigo: '123456',
      })
      expect(API.post).toHaveBeenCalledWith('/password-reset/confirm/', {
        token: 'abc123',
        codigo: '123456',
        password: PASSWORD,
        confirm_password: PASSWORD,
      })
    })

    it.each([
      [
        'errores por campo (se unen)',
        { errores: { password: ['Muy común'], confirm_password: ['No coincide'] } },
        'Muy común. No coincide',
      ],
      ['error general', { error: 'Token vencido' }, 'Token vencido'],
      ['sin detalle', {}, 'Error al restablecer la contraseña'],
    ])('error del backend al restablecer (%s) -> "%s"', async (_nombre, data, mensaje) => {
      await abrirFormularioDeReset({ confirm: falla(data) })
      escribirReset()
      enviarReset()

      expect(await screen.findByText(mensaje)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Restablecer Contraseña' }).disabled).toBe(false)
    })

    it('mientras restablece bloquea el botón y el código', async () => {
      let resolver
      await abrirFormularioDeReset({ confirm: () => new Promise((r) => { resolver = r }) })
      escribirReset()
      enviarReset()

      const boton = await screen.findByRole('button', { name: 'Restableciendo...' })
      expect(boton.disabled).toBe(true)
      expect(screen.getByLabelText('Código de Verificación').disabled).toBe(true)

      resolver({ data: { mensaje: 'ok' } })
      expect(await screen.findByRole('heading', { name: 'Contraseña Restablecida' })).toBeInTheDocument()
    })
  })

  describe('pantalla final', () => {
    it('con sesión abierta lo dice, y "Ir al inicio" lleva al inicio', async () => {
      await abrirFormularioDeReset({
        confirm: () => Promise.resolve({ data: { usuario: { id: 1 }, access_token: 'tok' } }),
      })
      escribirReset()
      enviarReset()

      await screen.findByRole('heading', { name: 'Contraseña Restablecida' })
      expect(screen.getByText(/tu sesión está abierta/i)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Ir al inicio' }))
      expect(screen.getByText('PAGINA INICIO')).toBeInTheDocument()
    })

    it('sin sesión solo confirma que la contraseña se actualizó', async () => {
      await abrirFormularioDeReset()
      escribirReset()
      enviarReset()

      await screen.findByRole('heading', { name: 'Contraseña Restablecida' })
      expect(screen.getByText(/actualizada correctamente/i)).toBeInTheDocument()
      expect(screen.queryByText(/tu sesión está abierta/i)).toBeNull()
    })
  })
})
