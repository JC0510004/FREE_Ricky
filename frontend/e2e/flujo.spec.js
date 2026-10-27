// Flujo E2E de FREE_RICKY: un solo usuario, una sola pestaña, en orden.
//
// POR QUÉ UNA SOLA PESTAÑA Y EN ORDEN (no un login guardado por test):
//  - El login tiene límite de 5 intentos por minuto por IP.
//  - El backend ROTA la cookie de refresh en cada renovación y manda la anterior
//    a la lista negra: una cookie guardada solo sirve UNA vez. Aquí la misma
//    pestaña conserva siempre la cookie vigente.
// Por eso los tests dependen unos de otros: si uno falla, los siguientes se saltan.
//
// Variables (frontend/.env.e2e): E2E_USER, E2E_PASSWORD, E2E_BASE_URL
// Opcional: E2E_API_URL (p. ej. http://192.168.18.50:8080/api) para comprobar
// que el logout invalida el refresh en el servidor.
import { test, expect } from '@playwright/test'

const USUARIO = process.env.E2E_USER
const CLAVE = process.env.E2E_PASSWORD
const API_URL = process.env.E2E_API_URL

test.describe.configure({ mode: 'serial' })

let page
// Cookie de refresh vigente justo antes del logout (para reenviarla después).
let cookieRefreshAntesDelLogout = null

test.beforeAll(async ({ browser }) => {
  if (!USUARIO || !CLAVE) {
    throw new Error('Faltan E2E_USER y E2E_PASSWORD en frontend/.env.e2e')
  }
  const contexto = await browser.newContext()
  page = await contexto.newPage()
})

test.afterAll(async () => {
  await page?.context().close()
})

// Ayudante: lee una clave de localStorage dentro del navegador.
const leerLocal = (clave) => page.evaluate((k) => localStorage.getItem(k), clave)

test.describe('Flujo completo del jugador', () => {
  test('1. sin sesión, /home y /admin están bloqueadas', async () => {
    await page.goto('/home')
    await expect(page).not.toHaveURL(/\/home/)

    await page.goto('/admin')
    await expect(page).not.toHaveURL(/\/admin/)
  })

  test('2. login con contraseña incorrecta muestra el error y no entra', async () => {
    await page.goto('/login')
    await page.getByLabel('Usuario o Correo').fill(USUARIO)
    await page.getByLabel('Contraseña', { exact: true }).fill('Incorrecta123!')
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click()

    await expect(page.getByText('Credenciales incorrectas')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    expect(await leerLocal('usuario:v1')).toBeNull()
  })

  test('3. login correcto lleva al inicio y muestra al usuario', async () => {
    await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click()

    // Tras el login la app navega a la landing ('/').
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: 'Menú de usuario' })).toContainText(USUARIO)

    // El usuario se guarda, pero NINGÚN token debe quedar en el almacenamiento.
    const guardado = JSON.parse(await leerLocal('usuario:v1'))
    expect(guardado.username).toBe(USUARIO)
    const almacenes = await page.evaluate(() =>
      JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
    expect(almacenes).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/) // forma de un JWT
  })

  test('4. el panel carga datos reales del backend', async () => {
    // Navegación dentro de la app (el token sigue solo en memoria).
    await page.getByRole('button', { name: 'Menú de usuario' }).click()
    await page.getByRole('link', { name: 'Mi Panel' }).click()

    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByRole('heading', { name: USUARIO, level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ranking Global' })).toBeVisible()

    // Esperar a que terminen las 4 cargas y comprobar que ninguna falló.
    await expect(page.getByText('Cargando ranking...')).toHaveCount(0)
    await expect(page.getByText(/\d+ disponibles/)).toBeVisible()
    await expect(page.getByText('No se pudieron cargar los datos')).toHaveCount(0)

    // Las tarjetas de estadísticas muestran un valor, no el "—" de error.
    const tarjeta = page.locator('article', { hasText: 'Partidas jugadas' })
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta).not.toContainText('—')
  })

  test('5. recargar con F5 mantiene la sesión (refresh por cookie)', async () => {
    await page.reload()

    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByRole('heading', { name: USUARIO, level: 1 })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/\d+ disponibles/)).toBeVisible()
    await expect(page.getByText('No se pudieron cargar los datos')).toHaveCount(0)
  })

  test('6. "Jugar" abre la pantalla del juego con el iframe de Unity', async () => {
    const botones = page.getByRole('button', { name: 'Jugar' })
    test.skip((await botones.count()) === 0, 'No hay niveles creados: nada que jugar')

    await botones.first().click()
    await expect(page).toHaveURL(/\/juego$/)

    // Solo se comprueba que el iframe existe y apunta al servidor del juego.
    // Jugar dentro de Unity no se automatiza de forma fiable.
    const iframe = page.locator('iframe[title="Salt Born"]')
    await expect(iframe).toBeVisible()
    await expect(iframe).toHaveAttribute('src', /:8080/)

    // Salir sin jugar no debe registrar ninguna partida.
    await page.goBack()
    await expect(page).toHaveURL(/\/home$/)
  })

  test('7. un jugador no entra al panel de administración', async () => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByText('Panel de Control')).toHaveCount(0)
  })

  test('8. cerrar sesión limpia todo y vuelve a bloquear el panel', async () => {
    // Se guarda la cookie de refresh vigente ANTES de cerrar sesión: el paso 9
    // la reenvía a mano para comprobar que el servidor la dio de baja.
    const cookies = await page.context().cookies()
    cookieRefreshAntesDelLogout = cookies.find((c) => /refresh/i.test(c.name)) ?? null

    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()

    await expect(page).not.toHaveURL(/\/home/)
    await expect.poll(() => leerLocal('usuario:v1')).toBeNull()

    await page.goto('/home')
    await expect(page).not.toHaveURL(/\/home/)
  })

  test('9. tras cerrar sesión, el servidor ya no acepta el refresh anterior', async ({ playwright }) => {
    test.skip(!API_URL, 'Define E2E_API_URL para comprobar el refresh en el servidor')
    expect(
      cookieRefreshAntesDelLogout,
      'No se encontró la cookie de refresh antes del logout',
    ).not.toBeNull()

    // El navegador ya borró su copia; aquí se reenvía la cookie vieja a mano,
    // desde un cliente limpio, como lo haría quien la hubiera robado.
    const { name, value } = cookieRefreshAntesDelLogout
    const limpio = await playwright.request.newContext()
    const res = await limpio.post(`${API_URL}/token/refresh/`, {
      headers: { Cookie: `${name}=${value}` },
    })
    const cuerpo = await res.text()
    await limpio.dispose()

    // 401 = el servidor la rechaza (en la lista negra). 200 = la sesión sigue viva.
    expect(res.status(), `Respuesta del servidor: ${cuerpo}`).toBe(401)
  })
})