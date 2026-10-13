// ─── TESTS: pages/Register.jsx ────────────────────────────────────────
// Se simulan useAuth (para controlar qué responde el registro) y useNavigate
// (para comprobar a dónde redirige). Todo lo demás es el componente real.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { registrar, navegar } = vi.hoisted(() => ({
  registrar: vi.fn(),
  navegar: vi.fn(),
}))

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ register: registrar }),
}))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navegar,
}))

import Register from '../Register'

// ─── Ayudas ───────────────────────────────────────────────────────────
const VALIDO = {
  username: 'juan_123',
  email: 'juan@correo.com',
  password: 'Clave123!',
  confirmPassword: 'Clave123!',
}

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  )
}

// Escribe en los cuatro campos; lo que no se indique usa el valor válido.
function rellenar(campos = {}) {
  const datos = { ...VALIDO, ...campos }
  fireEvent.change(screen.getByLabelText('Nombre de Usuario'), {
    target: { value: datos.username },
  })
  fireEvent.change(screen.getByLabelText('Correo Electrónico'), {
    target: { value: datos.email },
  })
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: datos.password },
  })
  fireEvent.change(screen.getByLabelText('Confirmar Contraseña'), {
    target: { value: datos.confirmPassword },
  })
}

const enviar = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Crear Cuenta' }))

beforeEach(() => {
  registrar.mockReset()
  navegar.mockReset()
})

// ══════════════════════════════════════════════════════════════════════
describe('Register - pantalla', () => {
  it('muestra el título y los cuatro campos', () => {
    renderRegister()
    expect(screen.getByRole('heading', { name: 'Crear Cuenta' })).toBeTruthy()
    expect(screen.getByLabelText('Nombre de Usuario')).toBeTruthy()
    expect(screen.getByLabelText('Correo Electrónico')).toBeTruthy()
    expect(screen.getByLabelText('Contraseña')).toBeTruthy()
    expect(screen.getByLabelText('Confirmar Contraseña')).toBeTruthy()
  })

  it('tiene los enlaces de salida y de inicio de sesión', () => {
    renderRegister()
    expect(
      screen.getByRole('link', { name: 'Salir a la página principal' }).getAttribute('href')
    ).toBe('/')
    expect(screen.getByRole('link', { name: 'SALT BORN' }).getAttribute('href')).toBe('/')
    expect(
      screen.getByRole('link', { name: 'Iniciar Sesión' }).getAttribute('href')
    ).toBe('/login')
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Register - validación en el navegador', () => {
  it.each([
    ['usuario vacío', { username: '' }, 'El usuario es requerido'],
    ['usuario muy corto', { username: 'ab' }, 'Mínimo 3 caracteres'],
    ['usuario con espacios', { username: 'juan perez' }, 'Solo letras, números, _ y -'],
    ['usuario con símbolos', { username: 'juan@123' }, 'Solo letras, números, _ y -'],
    ['correo vacío', { email: '' }, 'El correo es requerido'],
    ['correo sin @', { email: 'no-es-correo' }, 'Debe ser un correo electrónico válido'],
    ['correo sin dominio', { email: 'juan@' }, 'Debe ser un correo electrónico válido'],
    ['contraseña vacía', { password: '', confirmPassword: '' }, 'La contraseña es requerida'],
    ['contraseña corta', { password: 'Ab1!', confirmPassword: 'Ab1!' }, 'Mínimo 8 caracteres'],
    ['sin mayúscula', { password: 'clave123!', confirmPassword: 'clave123!' }, 'Debe tener una mayúscula'],
    ['sin minúscula', { password: 'CLAVE123!', confirmPassword: 'CLAVE123!' }, 'Debe tener una minúscula'],
    ['sin número', { password: 'Clavecita!', confirmPassword: 'Clavecita!' }, 'Debe tener un número'],
    ['sin carácter especial', { password: 'Clave1234', confirmPassword: 'Clave1234' }, 'Debe tener un carácter especial'],
    ['confirmación vacía', { confirmPassword: '' }, 'Confirma tu contraseña'],
    ['confirmación distinta', { confirmPassword: 'Otra123!' }, 'No coinciden'],
  ])('%s -> muestra "%s" y no envía', (_nombre, campos, mensaje) => {
    renderRegister()
    rellenar(campos)
    enviar()

    expect(screen.getByText(mensaje)).toBeTruthy()
    expect(registrar).not.toHaveBeenCalled()
  })

  it('un formulario vacío muestra los cuatro errores a la vez', () => {
    renderRegister()
    enviar()

    expect(screen.getByText('El usuario es requerido')).toBeTruthy()
    expect(screen.getByText('El correo es requerido')).toBeTruthy()
    expect(screen.getByText('La contraseña es requerida')).toBeTruthy()
    expect(screen.getByText('Confirma tu contraseña')).toBeTruthy()
    expect(registrar).not.toHaveBeenCalled()
  })

  it('acepta "_" como carácter especial', () => {
    registrar.mockResolvedValue({ access_token: 'x' })
    renderRegister()
    rellenar({ password: 'Clave123_', confirmPassword: 'Clave123_' })
    enviar()
    expect(screen.queryByText('Debe tener un carácter especial')).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Register - envío', () => {
  it('registro nuevo: llama al registro con los datos y va al inicio', async () => {
    registrar.mockResolvedValue({ access_token: 'token-123' })
    renderRegister()
    rellenar()
    enviar()

    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/'))
    expect(registrar).toHaveBeenCalledWith({
      username: 'juan_123',
      email: 'juan@correo.com',
      password: 'Clave123!',
      confirm_password: 'Clave123!',
    })
  })

  it('recorta espacios del usuario y pasa el correo a minúsculas', async () => {
    registrar.mockResolvedValue({ access_token: 'x' })
    renderRegister()
    rellenar({ username: '  juan_123  ', email: '  JUAN@Correo.COM  ' })
    enviar()

    await waitFor(() => expect(registrar).toHaveBeenCalled())
    const enviado = registrar.mock.calls[0][0]
    expect(enviado.username).toBe('juan_123')
    expect(enviado.email).toBe('juan@correo.com')
  })

  it('no modifica la contraseña (no recorta ni cambia mayúsculas)', async () => {
    registrar.mockResolvedValue({ access_token: 'x' })
    renderRegister()
    rellenar({ password: 'Clave123! ', confirmPassword: 'Clave123! ' })
    enviar()

    await waitFor(() => expect(registrar).toHaveBeenCalled())
    expect(registrar.mock.calls[0][0].password).toBe('Clave123! ')
  })

  it('al corregir el formulario desaparecen los errores anteriores', async () => {
    registrar.mockResolvedValue({ access_token: 'x' })
    renderRegister()
    enviar()
    expect(screen.getByText('El usuario es requerido')).toBeTruthy()

    rellenar()
    enviar()
    await waitFor(() => expect(navegar).toHaveBeenCalled())
    expect(screen.queryByText('El usuario es requerido')).toBeNull()
  })

  it('mientras envía bloquea los campos y el botón, y los libera al terminar', async () => {
    let resolver
    registrar.mockImplementation(
      () => new Promise((r) => { resolver = r })
    )
    renderRegister()
    rellenar()
    enviar()

    const boton = await screen.findByRole('button', { name: 'Creando cuenta...' })
    expect(boton.disabled).toBe(true)
    expect(screen.getByLabelText('Nombre de Usuario').disabled).toBe(true)
    expect(screen.getByLabelText('Correo Electrónico').disabled).toBe(true)
    expect(screen.getByLabelText('Contraseña').disabled).toBe(true)

    await act(async () => {
      resolver({ access_token: 'x' })
    })

    const listo = screen.getByRole('button', { name: 'Crear Cuenta' })
    expect(listo.disabled).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Register - cuenta reactivada (sin access_token)', () => {
  it('muestra el mensaje del servidor en vez del formulario y no navega', async () => {
    registrar.mockResolvedValue({ mensaje: 'Tu cuenta fue reactivada' })
    renderRegister()
    rellenar()
    enviar()

    expect(await screen.findByRole('heading', { name: 'Revisa tu Correo' })).toBeTruthy()
    expect(screen.getByText('Tu cuenta fue reactivada')).toBeTruthy()
    expect(screen.queryByLabelText('Nombre de Usuario')).toBeNull()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('usa un mensaje por defecto si el servidor no manda uno', async () => {
    registrar.mockResolvedValue({})
    renderRegister()
    rellenar()
    enviar()

    expect(
      await screen.findByText('Cuenta reactivada. Revisa tu correo para confirmar el email.')
    ).toBeTruthy()
  })

  it('también funciona si el registro no devuelve nada', async () => {
    registrar.mockResolvedValue(undefined)
    renderRegister()
    rellenar()
    enviar()

    expect(await screen.findByRole('heading', { name: 'Revisa tu Correo' })).toBeTruthy()
  })

  it('el botón "Iniciar Sesión" lleva al login', async () => {
    registrar.mockResolvedValue({ mensaje: 'ok' })
    renderRegister()
    rellenar()
    enviar()

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar Sesión' }))
    expect(navegar).toHaveBeenCalledWith('/login')
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Register - errores del servidor', () => {
  const errorServidor = (errores) => ({ response: { data: { errores } } })

  it('muestra cada error en su campo', async () => {
    registrar.mockRejectedValue(
      errorServidor({
        username: ['Ese usuario ya existe'],
        email: ['Ese correo ya está registrado'],
        password: ['Contraseña demasiado común'],
        confirm_password: ['La confirmación no coincide'],
      })
    )
    renderRegister()
    rellenar()
    enviar()

    expect(await screen.findByText('Ese usuario ya existe')).toBeTruthy()
    expect(screen.getByText('Ese correo ya está registrado')).toBeTruthy()
    expect(screen.getByText('Contraseña demasiado común')).toBeTruthy()
    expect(screen.getByText('La confirmación no coincide')).toBeTruthy()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('un campo desconocido va al mensaje general', async () => {
    registrar.mockRejectedValue(errorServidor({ otro_campo: ['Algo salió mal'] }))
    renderRegister()
    rellenar()
    enviar()

    expect(await screen.findByText('Algo salió mal')).toBeTruthy()
  })

  it('de cada campo solo muestra el primer mensaje', async () => {
    registrar.mockRejectedValue(
      errorServidor({ username: ['Primer error', 'Segundo error'] })
    )
    renderRegister()
    rellenar()
    enviar()

    expect(await screen.findByText('Primer error')).toBeTruthy()
    expect(screen.queryByText('Segundo error')).toBeNull()
  })

  it('un error sin detalle (red caída) muestra el mensaje genérico', async () => {
    registrar.mockRejectedValue(new Error('Network Error'))
    renderRegister()
    rellenar()
    enviar()

    expect(await screen.findByText('Error al registrar. Intente de nuevo.')).toBeTruthy()
  })

  it('después de un error el formulario vuelve a estar disponible', async () => {
    registrar.mockRejectedValue(new Error('Network Error'))
    renderRegister()
    rellenar()
    enviar()

    await screen.findByText('Error al registrar. Intente de nuevo.')
    expect(screen.getByRole('button', { name: 'Crear Cuenta' }).disabled).toBe(false)
    expect(screen.getByLabelText('Nombre de Usuario').disabled).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Register - mostrar y ocultar contraseñas', () => {
  it('cada botón alterna solo su propio campo', () => {
    renderRegister()
    const clave = screen.getByLabelText('Contraseña')
    const confirmacion = screen.getByLabelText('Confirmar Contraseña')
    expect(clave.getAttribute('type')).toBe('password')
    expect(confirmacion.getAttribute('type')).toBe('password')

    const [botonClave, botonConfirmacion] = screen.getAllByRole('button', { name: 'Mostrar' })

    fireEvent.click(botonClave)
    expect(clave.getAttribute('type')).toBe('text')
    expect(confirmacion.getAttribute('type')).toBe('password')
    expect(botonClave.getAttribute('aria-label')).toBe('Ocultar')

    fireEvent.click(botonConfirmacion)
    expect(confirmacion.getAttribute('type')).toBe('text')

    fireEvent.click(botonClave)
    expect(clave.getAttribute('type')).toBe('password')
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('Register - fortaleza de la contraseña', () => {
  const escribirClave = (valor) =>
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: valor } })

  it('no muestra indicadores mientras la contraseña está vacía', () => {
    renderRegister()
    expect(screen.queryByText('Débil')).toBeNull()
    expect(screen.queryByText('Media')).toBeNull()
    expect(screen.queryByText('Fuerte')).toBeNull()
    expect(screen.queryByText('Al menos 8 caracteres')).toBeNull()
  })

  it.each([
    ['abc', 'Débil'],
    ['abcdefgh', 'Débil'],
    ['Abcdefgh', 'Media'],
    ['Abcdefg1', 'Media'],
    ['Abcdefg1!', 'Fuerte'],
    ['Clave123!', 'Fuerte'],
  ])('"%s" se califica como %s', (clave, etiqueta) => {
    renderRegister()
    escribirClave(clave)
    expect(screen.getByText(etiqueta)).toBeTruthy()
  })

  it('la barra pinta tantos segmentos como puntos tiene la contraseña', () => {
    const { container } = renderRegister()
    escribirClave('Abcdefg1!') // 5 puntos

    const segmentos = [...container.querySelectorAll('.auth-strength-segment')]
    expect(segmentos).toHaveLength(6)
    const sinPintar = segmentos.filter((s) => /255,\s*255,\s*255/.test(s.style.background))
    expect(sinPintar).toHaveLength(1)
  })

  it('lista los cinco requisitos y marca los que se cumplen', () => {
    const { container } = renderRegister()
    escribirClave('abc')

    const icono = (texto) =>
      screen.getByText(texto).closest('.auth-requirement').querySelector('.material-symbols-outlined')

    expect(container.querySelectorAll('.auth-requirement')).toHaveLength(5)

    expect(icono('Una minúscula').classList.contains('req-met')).toBe(true)
    expect(icono('Una minúscula').textContent).toBe('check_circle')

    ;['Al menos 8 caracteres', 'Una mayúscula', 'Un número', 'Un carácter especial'].forEach(
      (texto) => {
        expect(icono(texto).classList.contains('req-unmet')).toBe(true)
        expect(icono(texto).textContent).toBe('cancel')
      }
    )
  })

  it('con una contraseña completa todos los requisitos se cumplen', () => {
    const { container } = renderRegister()
    escribirClave('Clave123!')
    expect(container.querySelectorAll('.req-met')).toHaveLength(5)
    expect(container.querySelectorAll('.req-unmet')).toHaveLength(0)
  })
})