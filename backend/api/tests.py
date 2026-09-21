# ─── IMPORTACIONES ───────────────────────────────────────────────────────────
# TestCase de Django: clase base para tests unitarios con base de datos
# de prueba aislada (se crea y destruye automáticamente por cada test)
from django.test import TestCase, override_settings
from django.core import mail
from django.core.cache import cache as django_cache
from django.conf import settings as django_settings

# Expresiones regulares para extraer tokens de los emails de prueba
import re

# Hash de tokens/códigos de reset conocidos en los tests
import hashlib

# Función reverse: resuelve URLs desde su nombre de ruta definido en urls.py
# Evita hardcodear paths que podrían romperse al refactorizar
from django.urls import reverse

# Códigos de estado HTTP de DRF para assertions legibles y consistentes
from rest_framework import status

# APIClient: cliente de prueba de DRF que simula peticiones HTTP reales
# sin levantar un servidor; es rápido y permite testing de APIs REST
from rest_framework.test import APIClient

# Modelo de usuario para consultas directas a la base de datos de prueba
from .models import Usuario, Nivel, Partida, ConfirmacionReset
# Middleware de brute force: sus umbrales (MAX_ATTEMPTS) y helpers de lockout
# se reutilizan en los tests del panel de administración.
from .middleware import BruteForceIPMiddleware


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE REGISTRO DE USUARIO
# ═══════════════════════════════════════════════════════════════════════════════
# Valida todo el flujo de registro: desde el caso exitoso hastadiferentes
# escenarios de error (validación, duplicados, XSS, seguridad de contraseñas).
class RegistroTests(TestCase):
    # Configuración inicial: se ejecuta ANTES de cada método de test.
    # Crea el cliente HTTP, la URL de registro y datos válidos base
    # que se reutilizan (y mutan) en cada test.
    def setUp(self):
        # Cliente autenticado con credenciales por defecto
        self.client = APIClient()
        # URL del endpoint de registro resuelta por nombre
        self.url = reverse('register')
        # Datos válidos base; cada test puede sobrescribir campos específicos
        self.valid_data = {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }

    # Verifica que un registro con datos válidos retorne 201 Created
    # y que la respuesta contenga el token de acceso y los datos del usuario
    def test_registro_exitoso(self):
        # Realiza POST al endpoint de registro con formato JSON
        response = self.client.post(self.url, self.valid_data, format='json')
        # 201 Created: el usuario fue creado exitosamente en la BD
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # El token de acceso JWT se retorna para auto-login inmediato
        self.assertIn('access_token', response.data)
        # Verifica que el username en la respuesta coincida con el enviado
        self.assertEqual(response.data['usuario']['username'], 'testuser')

    # Verifica que contraseñas débiles sean rechazadas con 400 Bad Request
    # Cubre la validación de longitud mínima (8 caracteres)
    def test_registro_password_debil(self):
        # Sobrescribe la contraseña con una cadena corta que no cumple
        # las reglas de fortaleza (sin mayúsculas, sin especiales, muy corta)
        data = {**self.valid_data, 'password': '123', 'confirm_password': '123'}
        response = self.client.post(self.url, data, format='json')
        # 400 Bad Request: el serializer rechazó la contraseña débil
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Verifica que emails con formato inválido sean rechazados
    # Cubre la validación de regex del email
    def test_registro_email_invalido(self):
        # "no-email" no contiene @ ni dominio; la regex lo rechaza
        data = {**self.valid_data, 'email': 'no-email'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Verifica que usernames con caracteres especiales sean rechazados
    # Cubre la validación de caracteres alfanuméricos/guión bajo
    def test_registro_username_invalido(self):
        # "<script>" contiene caracteres no alfanuméricos y es un payload XSS;
        # debe ser rechazado tanto por validación de formato como por sanitización
        data = {**self.valid_data, 'username': '<script>'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Verifica que contraseñas que no coincidan sean rechazadas
    # Cubre la validación cruzada de campos (confirm_password)
    def test_registro_password_no_coinciden(self):
        # La confirmación difiere de la contraseña original
        data = {**self.valid_data, 'confirm_password': 'otraPass123!'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Verifica que no se puedan registrar dos usuarios con el mismo username/email
    # Cubre la restricción de unicidad del modelo y la validación del serializer
    def test_registro_duplicado(self):
        # Primer registro: debe ser exitoso (201)
        self.client.post(self.url, self.valid_data, format='json')
        # Segundo registro con los mismos datos: debe fallar (400)
        response = self.client.post(self.url, self.valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Al "eliminar" un usuario, el admin solo lo desactiva (soft delete).
    # Volver a registrarlo con el mismo username/email debe REACTIVAR esa
    # misma cuenta (no crear un duplicado ni fallar por "ya existe"), PERO la
    # cuenta permanece inactiva hasta que el propietario confirma el email
    # desde el enlace: nadie puede reclamar una cuenta desactivada en su lugar.
    def test_registro_reactiva_cuenta_desactivada(self):
        self.client.post(self.url, self.valid_data, format='json')
        usuario = Usuario.objects.get(username='testuser')
        usuario.is_active = False
        usuario.save(update_fields=['is_active'])

        data = {
            **self.valid_data,
            'password': 'NuevaPass123!',
            'confirm_password': 'NuevaPass123!',
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        usuario.refresh_from_db()
        # La cuenta sigue desactivada hasta confirmar el correo.
        self.assertFalse(usuario.is_active)
        self.assertTrue(usuario.check_password('NuevaPass123!'))
        # La cuenta se reutiliza: no queda una fila duplicada
        self.assertEqual(Usuario.objects.filter(username__iexact='testuser').count(), 1)
        self.assertEqual(response.data['usuario']['id'], usuario.id)
        # Sin sesión: la reactivación NO emite tokens hasta verificar el email.
        self.assertNotIn('access_token', response.data)

        # El email de reactivación lleva el token que activa la cuenta.
        self.assertEqual(len(mail.outbox), 2)
        match = re.search(r'verificar-email\?token=([0-9a-f]+)', mail.outbox[-1].body)
        self.assertIsNotNone(match)
        resp = self.client.post(reverse('verificar_email'), {'token': match.group(1)}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        usuario.refresh_from_db()
        self.assertTrue(usuario.is_active)
        self.assertTrue(usuario.is_verified)

    # Si una cuenta desactivada tiene el username pero se registra con un
    # email nuevo, debe poder reactivarse adoptando el email del formulario
    # (siempre tras confirmar el correo).
    def test_registro_reactiva_con_email_nuevo(self):
        self.client.post(self.url, self.valid_data, format='json')
        usuario = Usuario.objects.get(username='testuser')
        usuario.is_active = False
        usuario.save(update_fields=['is_active'])

        data = {**self.valid_data, 'email': 'nuevo@gmail.com'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        usuario.refresh_from_db()
        self.assertFalse(usuario.is_active)
        self.assertNotIn('access_token', response.data)
        self.assertEqual(usuario.email, 'nuevo@gmail.com')
        self.assertEqual(Usuario.objects.filter(username__iexact='testuser').count(), 1)

        match = re.search(r'verificar-email\?token=([0-9a-f]+)', mail.outbox[-1].body)
        resp = self.client.post(reverse('verificar_email'), {'token': match.group(1)}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        usuario.refresh_from_db()
        self.assertTrue(usuario.is_active)

    # El registro de un usuario nuevo envía un email de verificación, pero NO
    # bloquea el auto-login (acceso inmediato con banner de "verifica tu correo").
    def test_registro_envia_email_verificacion(self):
        response = self.client.post(self.url, self.valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access_token', response.data)

        usuario = Usuario.objects.get(username='testuser')
        self.assertFalse(usuario.is_verified)

        self.assertEqual(len(mail.outbox), 1)
        match = re.search(r'verificar-email\?token=([0-9a-f]+)', mail.outbox[0].body)
        self.assertIsNotNone(match)
        resp = self.client.post(reverse('verificar_email'), {'token': match.group(1)}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        usuario.refresh_from_db()
        self.assertTrue(usuario.is_verified)

    # Un token de verificación inválido o expirado debe ser rechazado.
    def test_registro_verificacion_token_invalido(self):
        self.client.post(self.url, self.valid_data, format='json')
        resp = self.client.post(reverse('verificar_email'), {'token': 'a' * 32}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        # El usuario conserva su estado: sin verificar y activo (auto-login).
        usuario = Usuario.objects.get(username='testuser')
        self.assertFalse(usuario.is_verified)
        self.assertTrue(usuario.is_active)

    # El token de verificación de email es de un solo uso: tras verificar, no sirve de nuevo.
    def test_registro_verificacion_token_un_solo_uso(self):
        self.client.post(self.url, self.valid_data, format='json')
        match = re.search(r'verificar-email\?token=([0-9a-f]+)', mail.outbox[0].body)
        token = match.group(1)
        self.assertEqual(self.client.post(reverse('verificar_email'), {'token': token}, format='json').status_code, 200)
        resp = self.client.post(reverse('verificar_email'), {'token': token}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # El registro acepta guiones en el username (igual que la edición de perfil).
    def test_registro_username_con_guion(self):
        data = {**self.valid_data, 'username': 'test-user'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    # Verifica que un POST vacío retorne 400 con errores de campo requerido
    # Cubre la validación de campos obligatorios del serializer
    def test_registro_sin_campos(self):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Verifica que la contraseña NUNCA se exponga en la respuesta HTTP
    # Incluso con write_only=True, es importante validar que no aparezca
    # en la respuesta del usuario creado (fallo de configuración)
    def test_password_no_expuesta(self):
        response = self.client.post(self.url, self.valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # El objeto usuario en la respuesta no debe contener el campo password
        self.assertNotIn('password', response.data.get('usuario', {}))

    # Verifica que payloads XSS en el username sean rechazados
    # Aunque sanitización lo limpia, la validación de formato debe rechazarlo
    # antes de que llegue a la base de datos
    def test_xss_en_username(self):
        # Tag <script> es el vector XSS más básico; debe ser bloqueado
        data = {**self.valid_data, 'username': '<script>alert(1)</script>'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE INICIO DE SESIÓN
# ═══════════════════════════════════════════════════════════════════════════════
# Valida el flujo de autenticación: login exitoso, credenciales incorrectas,
# login por email, y protección contra enumeración de usuarios.
class LoginTests(TestCase):
    # setUp registra un usuario de prueba para que cada test de login
    # tenga una cuenta válida con la cual autenticarse
    def setUp(self):
        self.client = APIClient()
        # URL de registro para crear el usuario de prueba
        self.register_url = reverse('register')
        # URL de login para las pruebas de autenticación
        self.login_url = reverse('login')
        # Credenciales que se usarán para registrar el usuario
        self.credentials = {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        # Crea el usuario de prueba antes de cada test de login
        self.client.post(self.register_url, self.credentials, format='json')

    # Verifica que un login con credenciales correctas retorne 200 OK
    # con token de acceso y datos del usuario
    def test_login_exitoso(self):
        response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Token JWT necesario para acceder a endpoints protegidos
        self.assertIn('access_token', response.data)
        # Datos del usuario autenticado
        self.assertIn('usuario', response.data)

    # Verifica que se pueda iniciar sesión usando el email como identificador
    # El serializer acepta usuario O email indistintamente
    def test_login_con_email(self):
        response = self.client.post(self.login_url, {
            'username': 'test@gmail.com',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # Verifica que contraseña incorrecta retorne 401 Unauthorized
    # con mensaje de error genérico (no revela si el usuario existe)
    def test_login_password_incorrecta(self):
        response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'WrongPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        # Mensaje genérico: no indica si el usuario o la contraseña es incorrecta
        self.assertIn('error', response.data)

    # Verifica que usuario inexistente retorne 401 con el mismo mensaje
    # que contraseña incorrecta (protección contra enumeración)
    def test_login_usuario_inexistente(self):
        response = self.client.post(self.login_url, {
            'username': 'noexiste12345',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        # Mensaje idéntico al de contraseña incorrecta
        self.assertEqual(response.data['error'], 'Credenciales incorrectas')

    # TEST CRÍTICO DE SEGURIDAD: verifica que el endpoint no revele
    # información sobre la existencia de usuarios. Si el mensaje de error
    # difiere entre "usuario no existe" y "contraseña incorrecta", un
    # atacante podría enumerar usuarios válidos probando cada nombre.
    def test_proteccion_enumeracion(self):
        # Intento con usuario que NO existe en la base de datos
        resp_no_user = self.client.post(self.login_url, {
            'username': 'usuario_que_no_existe_999',
            'password': 'TestPass123!',
        }, format='json')
        # Intento con usuario existente pero contraseña INCORRECTA
        resp_wrong_pass = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'WrongPass' + 'X' * 10,
        }, format='json')
        # AMBOS mensajes deben ser idénticos para evitar enumeración
        self.assertEqual(
            resp_no_user.data.get('error', ''),
            resp_wrong_pass.data.get('error', ''),
        )


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE PROTECCIÓN DE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════
# Valida que los endpoints requieran autenticación y permisos adecuados.
# Cubre: endpoints públicos, protegidos por auth, y protegidos por rol admin.
class ProteccionEndpointTests(TestCase):
    # Registra un usuario y obtiene su token JWT para tests autenticados
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.data = {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        # Registra el usuario y captura la respuesta
        reg = self.client.post(self.register_url, self.data, format='json')
        # Extrae el token de acceso JWT para usarlo en requests autenticados
        self.token = reg.data.get('access_token', '')

    # Verifica que la lista de usuarios requiera autenticación.
    # Sin token, debe retornar 401 Unauthorized.
    def test_usuarios_list_requiere_auth(self):
        url = reverse('usuario_list')
        # GET sin credenciales: debe ser rechazado
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # Verifica que el detalle de un usuario específico requiera autenticación
    def test_usuarios_detail_requiere_auth(self):
        url = reverse('usuario_detail', args=[1])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # Verifica que el logout requiera autenticación
    # Un usuario no autenticado no debería poder "cerrar sesión"
    def test_logout_requiere_auth(self):
        url = reverse('logout')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # Verifica que el ranking sea accesible SIN autenticación
    # El ranking es información pública que no compromete datos sensibles
    def test_ranking_publico(self):
        url = reverse('ranking')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # Verifica que un usuario normal (no admin) no pueda acceder
    # al listado de usuarios (restricción de permisos por rol)
    def test_usuarios_list_requiere_admin(self):
        url = reverse('usuario_list')
        # Adjunta el token JWT del usuario regular (no admin) en el header
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        # 403 Forbidden: autenticado pero sin permisos de administrador
        # Usuario normal sin rol admin debe recibir 403
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE HASHEO DE CONTRASEÑAS
# ═══════════════════════════════════════════════════════════════════════════════
# Verifica que las contraseñas se almacén correctamente hasheadas
# y que el mecanismo de verificación funcione correctamente.
# CRÍTICO: si estos tests fallan, las credenciales están comprometidas.
class PasswordHashingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('register')
        self.data = {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }

    # Verifica que la contraseña NUNCA se almacene en texto plano
    # en la base de datos. Debe estar hasheada con argon2 (el hasher
    # configurado en settings.py). Si se almacena en texto plano,
    # una filtración de la BD expone TODAS las contraseñas.
    def test_password_no_almacenada_texto_plano(self):
        self.client.post(self.url, self.data, format='json')
        usuario = Usuario.objects.get(username='testuser')
        # La contraseña almacenada NO debe ser igual al texto original
        self.assertNotEqual(usuario.password, 'TestPass123!')
        # El hash debe comenzar con 'argon2' indicando el algoritmo correcto
        # (argon2id, argon2i, o argon2d según la configuración)
        self.assertTrue(usuario.password.startswith('argon2'))

    # Verifica que check_password funcione correctamente:
    # - Acepta la contraseña correcta
    # - Rechaza una contraseña incorrecta
    # Esto valida que el hasher no solo almacena sino que también puede
    # verificar credenciales durante el login
    def test_verificacion_password(self):
        self.client.post(self.url, self.data, format='json')
        usuario = Usuario.objects.get(username='testuser')
        # Contraseña correcta: debe retornar True
        self.assertTrue(usuario.check_password('TestPass123!'))
        # Contraseña incorrecta: debe retornar False
        self.assertFalse(usuario.check_password('WrongPass123!'))


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE PROTECCIÓN CONTRA FUERZA BRUTA
# ═══════════════════════════════════════════════════════════════════════════════
# Valida el mecanismo de bloqueo por intentos fallidos de login.
# Previene ataques de fuerza bruta donde un atacante prueba miles
# de contraseñas; después de N intentos fallidos, la cuenta se bloquea.
class BruteForceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.data = {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        # Crea el usuario objetivo del ataque de fuerza bruta
        self.client.post(self.register_url, self.data, format='json')

    # Verifica que cada intento fallido incrementa el contador de
    # failed_attempts y que después de 5 intentos la cuenta se bloquea
    def test_incremento_intentos_fallidos(self):
        # Simula 5 intentos de login con contraseña incorrecta
        for i in range(5):
            self.client.post(self.login_url, {
                'username': 'testuser',
                'password': 'WrongPass123!',
            }, format='json')
        usuario = Usuario.objects.get(username='testuser')
        # El contador debe reflejar exactamente 5 intentos fallidos
        self.assertEqual(usuario.failed_attempts, 5)
        # La fecha de bloqueo debe estar establecida (cuenta bloqueada)
        self.assertIsNotNone(usuario.locked_until)

    # Verifica que después del bloqueo, incluso con la contraseña CORRECTA,
    # el login sea rechazado con 429 Too Many Requests
    def test_bloqueo_por_intentos(self):
        # Realiza 5 intentos fallidos para activar el bloqueo
        for _ in range(5):
            self.client.post(self.login_url, {
                'username': 'testuser',
                'password': 'WrongPass123!',
            }, format='json')
        # Intenta login con la contraseña CORRECTA después del bloqueo
        response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'TestPass123!',
        }, format='json')
        # 429 Too Many Requests: la cuenta está bloqueada temporalmente
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        # El mensaje de error debe contener "bloqueada" para informar al usuario
        self.assertIn('bloqueada', response.data.get('error', '').lower())

    # Verifica que un login exitoso RESETEA el contador de intentos fallidos
    # y desbloquea la cuenta. Sin esto, un usuario legítimo quedaría
    # bloqueado permanentemente después de equivocarse algunas veces.
    def test_reset_intentos_tras_login_exitoso(self):
        # Genera 3 intentos fallidos (por debajo del umbral de bloqueo)
        for _ in range(3):
            self.client.post(self.login_url, {
                'username': 'testuser',
                'password': 'WrongPass123!',
            }, format='json')
        # Verifica que el contador esté en 3 antes del login exitoso
        usuario_antes = Usuario.objects.get(username='testuser')
        self.assertEqual(usuario_antes.failed_attempts, 3)

        # Login exitoso con credenciales correctas
        response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verifica que el contador se reseteó a 0 y no hay bloqueo
        usuario_despues = Usuario.objects.get(username='testuser')
        self.assertEqual(usuario_despues.failed_attempts, 0)
        # locked_until debe ser None (sin bloqueo activo)
        self.assertIsNone(usuario_despues.locked_until)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE RECUPERACIÓN DE CONTRASEÑA
# ═══════════════════════════════════════════════════════════════════════════════
# Valida el flujo completo de reset de contraseña: solicitud, confirmación,
# expiración de tokens, y protección contra enumeración de usuarios.
class PasswordResetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.reset_url = reverse('password_reset')
        self.confirm_url = reverse('password_reset_confirm')
        self.verificar_codigo_url = reverse('password_reset_verificar_codigo')
        self.user_data = {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        self.client.post(self.register_url, self.user_data, format='json')
        self.token = 'fake_token_for_test'
        self.codigo = '123456'

    def _crear_reset(self, confirmado=True):
        """Crea directamente un registro de reset con token y código conocidos.

        Nota: se crea en la BD con esos valores en vez de solicitar por HTTP
        y sobreescribir el token_hash: cambiar la PK de un objeto persistido y
        hacer .save() provoca INSERT + fila huérfana (UPDATE a 0 filas).
        """
        ConfirmacionReset.objects.all().delete()
        return ConfirmacionReset.objects.create(
            usuario=Usuario.objects.get(username='testuser'),
            token_hash=hashlib.sha256(self.token.encode()).hexdigest(),
            codigo_hash=hashlib.sha256(self.codigo.encode()).hexdigest(),
            confirmado=confirmado,
        )

    def _confirmar(self, token=None, codigo=None, password='NewPass123!', confirm_password='NewPass123!'):
        return self.client.post(self.confirm_url, {
            'token': token or self.token,
            'codigo': codigo or self.codigo,
            'password': password,
            'confirm_password': confirm_password,
        }, format='json')

    def test_solicitud_reset_email_valido(self):
        response = self.client.post(self.reset_url, {'email': 'test@gmail.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('mensaje', response.data)
        # Se creó un registro de confirmación en la BD
        self.assertEqual(ConfirmacionReset.objects.count(), 1)

    def test_solicitud_reset_email_no_existe(self):
        response = self.client.post(self.reset_url, {'email': 'noexiste@gmail.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Mensaje genérico: no revela si el email existe
        self.assertIn('mensaje', response.data)
        self.assertEqual(ConfirmacionReset.objects.count(), 0)

    def test_solicitud_reset_email_invalido(self):
        response = self.client.post(self.reset_url, {'email': 'not-an-email'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_datos_validos(self):
        self._crear_reset(confirmado=True)
        response = self._confirmar()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verificar que la contraseña cambió
        usuario = Usuario.objects.get(username='testuser')
        self.assertTrue(usuario.check_password('NewPass123!'))

    def test_confirm_reset_requiere_confirmacion_previa(self):
        # El token existe pero el usuario NO confirmó su identidad desde el
        # enlace del correo → el restablecimiento debe ser rechazado.
        self._crear_reset(confirmado=False)
        response = self._confirmar()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        usuario = Usuario.objects.get(username='testuser')
        self.assertTrue(usuario.check_password('TestPass123!'))

    def test_confirm_reset_codigo_incorrecto(self):
        # Clic en el enlace pero código erróneo → rechazado y contraseña intacta.
        self._crear_reset(confirmado=True)
        response = self._confirmar(codigo='999999')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        usuario = Usuario.objects.get(username='testuser')
        self.assertTrue(usuario.check_password('TestPass123!'))

    def test_confirm_reset_codigo_requerido(self):
        self._crear_reset(confirmado=True)
        # Sin codigo → 400 por validación del serializer.
        response = self.client.post(self.confirm_url, {
            'token': self.token,
            'password': 'NewPass123!',
            'confirm_password': 'NewPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verificar_codigo_valido(self):
        self._crear_reset()
        response = self.client.post(self.verificar_codigo_url, {
            'token': self.token,
            'codigo': self.codigo,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valido'])

    def test_verificar_codigo_incorrecto(self):
        self._crear_reset()
        response = self.client.post(self.verificar_codigo_url, {
            'token': self.token,
            'codigo': '000000',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # La fuerza bruta del código de 6 dígitos por verificar-codigo/ debe ser
    # inviable: al superar MAX_INTENTOS_CODIGO (10) el token se invalida.
    def test_verificar_codigo_bloquea_fuerza_bruta(self):
        self._crear_reset()
        for _ in range(ConfirmacionReset.MAX_INTENTOS_CODIGO):
            response = self.client.post(self.verificar_codigo_url, {
                'token': self.token,
                'codigo': '111111',
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # El registro se invalidó: el token ya no existe.
        self.assertEqual(ConfirmacionReset.objects.count(), 0)

    # Unos pocos fallos NO invalidan el token: el código correcto sigue valiendo.
    def test_verificar_codigo_correcto_tras_fallos(self):
        self._crear_reset()
        for _ in range(5):
            self.client.post(self.verificar_codigo_url, {
                'token': self.token,
                'codigo': '111111',
            }, format='json')
        record = ConfirmacionReset.objects.get()
        self.assertEqual(record.failed_attempts, 5)
        response = self.client.post(self.verificar_codigo_url, {
            'token': self.token,
            'codigo': self.codigo,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valido'])

    # Lo mismo protege el confirmar/ (donde también se exige el código).
    def test_confirm_reset_bloquea_fuerza_bruta(self):
        self._crear_reset(confirmado=True)
        for _ in range(ConfirmacionReset.MAX_INTENTOS_CODIGO):
            response = self._confirmar(codigo='999999')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        usuario = Usuario.objects.get(username='testuser')
        self.assertTrue(usuario.check_password('TestPass123!'))
        self.assertEqual(ConfirmacionReset.objects.count(), 0)

    def test_verificar_codigo_token_expirado(self):
        from django.utils import timezone as tz
        record = self._crear_reset()
        record.created_at = tz.now() - tz.timedelta(minutes=20)
        record.save()

        response = self.client.post(self.verificar_codigo_url, {
            'token': self.token,
            'codigo': self.codigo,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_invalida_sesiones_previas(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        usuario = Usuario.objects.get(username='testuser')
        old_refresh = str(RefreshToken.for_user(usuario))

        self._crear_reset(confirmado=True)
        response = self._confirmar()
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Un refresh token emitido ANTES del restablecimiento ya no vale.
        resp_refresh = self.client.post(reverse('token_refresh'), {
            'refresh_token': old_refresh,
        }, format='json')
        self.assertEqual(resp_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_confirm_reset_passwords_no_coinciden(self):
        self._crear_reset(confirmado=True)
        response = self._confirmar(confirm_password='DifferentPass123!')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_password_debil(self):
        self._crear_reset()
        response = self._confirmar(password='123', confirm_password='123')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_token_expirado(self):
        from django.utils import timezone as tz
        record = self._crear_reset()
        # Forzar expiración: retroceder la fecha de creación 20 minutos
        record.created_at = tz.now() - tz.timedelta(minutes=20)
        record.save()

        response = self._confirmar()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_token_inexistente(self):
        response = self._confirmar(token='token_que_no_existe_999')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE CIERRE DE SESIÓN
# ═══════════════════════════════════════════════════════════════════════════════
class LogoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.logout_url = reverse('logout')
        self.user_data = {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        reg = self.client.post(self.register_url, self.user_data, format='json')
        self.token = reg.data.get('access_token', '')
        # Hacer login para obtener refresh token en cookie
        self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'TestPass123!',
        }, format='json')

    def test_logout_exitoso(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.logout_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Sesión cerrada', response.data.get('mensaje', ''))

    def test_logout_sin_token(self):
        # Sin credenciales de autenticación: debe fallar con 401
        response = self.client.post(self.logout_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE REFRESH TOKEN
# ═══════════════════════════════════════════════════════════════════════════════
class RefreshTokenTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.refresh_url = reverse('token_refresh')
        self.user_data = {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        self.client.post(self.register_url, self.user_data, format='json')

    def _get_refresh_token(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        user = Usuario.objects.get(username='testuser')
        return str(RefreshToken.for_user(user))

    def test_refresh_valido(self):
        refresh_token = self._get_refresh_token()
        response = self.client.post(self.refresh_url, {
            'refresh_token': refresh_token,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', response.data)

    def test_refresh_token_invalido(self):
        response = self.client.post(self.refresh_url, {
            'refresh_token': 'token_absolutamente_invalido',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_sin_token(self):
        # Clear cookies to ensure no refresh_token is sent
        self.client.cookies.clear()
        response = self.client.post(self.refresh_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_refresh_conserva_claims_usuario_rol(self):
        from rest_framework_simplejwt.tokens import RefreshToken as RT
        refresh_token = self._get_refresh_token()
        response = self.client.post(self.refresh_url, {
            'refresh_token': refresh_token,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # El nuevo refresh token viaja en la cookie; sus claims personalizados
        # deben conservarse en la rotación.
        new_refresh_str = self.client.cookies['refresh_token'].value
        new_refresh = RT(new_refresh_str)
        self.assertEqual(new_refresh.payload.get('username'), 'testuser')
        self.assertEqual(new_refresh.payload.get('rol'), 'jugador')

    def test_refresh_usado_dos_veces_rechazado(self):
        refresh_token = self._get_refresh_token()
        r1 = self.client.post(self.refresh_url, {
            'refresh_token': refresh_token,
        }, format='json')
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        # Reutilizar el mismo refresh tras la rotación debe fallar.
        r2 = self.client.post(self.refresh_url, {
            'refresh_token': refresh_token,
        }, format='json')
        self.assertEqual(r2.status_code, status.HTTP_401_UNAUTHORIZED)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE NIVELES
# ═══════════════════════════════════════════════════════════════════════════════
class NivelTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.nivel_list_url = reverse('nivel_list')
        self.nivel_detail_url = lambda pk: reverse('nivel_detail', args=[pk])

        # Crear usuario normal
        reg = self.client.post(self.register_url, {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        self.user_token = reg.data.get('access_token', '')

        # Crear usuario admin directamente en la BD
        self.admin = Usuario.objects.create_superuser(
            username='adminuser',
            email='admin@gmail.com',
            password='AdminPass123!',
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)

        # Crear un nivel existente para tests de update/delete
        self.nivel = Nivel.objects.create(
            nombre='La Guarida',
            dificultad='facil',
            tiempo_limite=120,
        )

    def test_list_niveles_publico(self):
        response = self.client.get(self.nivel_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_crear_nivel_como_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        response = self.client.post(self.nivel_list_url, {
            'nombre': 'Nivel Nuevo',
            'dificultad': 'medio',
            'tiempo_limite': 90,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Nivel.objects.filter(nombre='Nivel Nuevo').exists())

    def test_crear_nivel_como_usuario_normal(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        response = self.client.post(self.nivel_list_url, {
            'nombre': 'Nivel No Permitido',
            'dificultad': 'facil',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_actualizar_nivel_como_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        url = self.nivel_detail_url(self.nivel.pk)
        response = self.client.put(url, {
            'nombre': 'La Guarida Actualizada',
            'dificultad': 'dificil',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.nivel.refresh_from_db()
        self.assertEqual(self.nivel.nombre, 'La Guarida Actualizada')

    def test_eliminar_nivel_como_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        url = self.nivel_detail_url(self.nivel.pk)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Nivel.objects.filter(pk=self.nivel.pk).exists())


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE PARTIDAS
# ═══════════════════════════════════════════════════════════════════════════════
class PartidaTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.partida_list_url = reverse('partida_list')

        reg = self.client.post(self.register_url, {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        self.token = reg.data.get('access_token', '')

        self.nivel = Nivel.objects.create(
            nombre='Nivel Test',
            dificultad='facil',
        )

    def test_list_partidas_autenticado(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.partida_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_crear_partida_datos_validos(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.partida_list_url, {
            'nivel': self.nivel.pk,
            'muertes': 3,
            'tiempo': 120,
            'puntuacion': 500,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Partida.objects.count(), 1)

    def test_crear_partida_sin_auth(self):
        response = self.client.post(self.partida_list_url, {
            'nivel': self.nivel.pk,
            'muertes': 0,
            'tiempo': 60,
            'puntuacion': 100,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Partida.objects.count(), 0)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE RANKING
# ═══════════════════════════════════════════════════════════════════════════════
class RankingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ranking_url = reverse('ranking')

    def test_ranking_retorna_datos(self):
        response = self.client.get(self.ranking_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_ranking_publico(self):
        # Sin autenticación: el ranking es información pública
        response = self.client.get(self.ranking_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_ranking_con_datos(self):
        # Crear datos de prueba: usuario, nivel y partidas.
        # El ranking es público, por lo que no se necesita token de acceso.
        user = Usuario.objects.create_user(
            username='player1',
            email='player1@gmail.com',
            password='TestPass123!',
        )
        nivel = Nivel.objects.create(nombre='Nivel Rank', dificultad='medio')
        Partida.objects.create(usuario=user, nivel=nivel, muertes=1, tiempo=60, puntuacion=800)
        Partida.objects.create(usuario=user, nivel=nivel, muertes=0, tiempo=45, puntuacion=1000)

        response = self.client.get(self.ranking_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)
        # Verificar que el usuario aparece en el ranking
        usernames = [r['username'] for r in response.data]
        self.assertIn('player1', usernames)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE CAMBIO DE CONTRASEÑA
# ═══════════════════════════════════════════════════════════════════════════════
class ChangePasswordTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.change_url = reverse('change_password')

        reg = self.client.post(self.register_url, {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        self.token = reg.data.get('access_token', '')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_cambio_password_correcta(self):
        response = self.client.post(self.change_url, {
            'old_password': 'TestPass123!',
            'new_password': 'NewSecure123!',
            'confirm_password': 'NewSecure123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verificar que la nueva contraseña funciona
        usuario = Usuario.objects.get(username='testuser')
        self.assertTrue(usuario.check_password('NewSecure123!'))

    def test_cambio_password_actual_incorrecta(self):
        response = self.client.post(self.change_url, {
            'old_password': 'WrongCurrent123!',
            'new_password': 'NewSecure123!',
            'confirm_password': 'NewSecure123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cambio_password_debil(self):
        response = self.client.post(self.change_url, {
            'old_password': 'TestPass123!',
            'new_password': '123',
            'confirm_password': '123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cambio_password_no_coinciden(self):
        response = self.client.post(self.change_url, {
            'old_password': 'TestPass123!',
            'new_password': 'NewSecure123!',
            'confirm_password': 'Different123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cambio_password_sin_auth(self):
        # Cliente sin token
        self.client.credentials()
        response = self.client.post(self.change_url, {
            'old_password': 'TestPass123!',
            'new_password': 'NewSecure123!',
            'confirm_password': 'NewSecure123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cambio_password_invalida_sesiones_previas(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        usuario = Usuario.objects.get(username='testuser')
        old_refresh = str(RefreshToken.for_user(usuario))

        response = self.client.post(self.change_url, {
            'old_password': 'TestPass123!',
            'new_password': 'NewSecure123!',
            'confirm_password': 'NewSecure123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Un refresh token emitido antes del cambio de contraseña ya no vale.
        resp_refresh = self.client.post(reverse('token_refresh'), {
            'refresh_token': old_refresh,
        }, format='json')
        self.assertEqual(resp_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cambio_password_cuenta_bloqueada(self):
        from django.utils import timezone as tz
        usuario = Usuario.objects.get(username='testuser')
        usuario.locked_until = tz.now() + tz.timedelta(minutes=5)
        usuario.save(update_fields=['locked_until'])

        response = self.client.post(self.change_url, {
            'old_password': 'TestPass123!',
            'new_password': 'NewSecure123!',
            'confirm_password': 'NewSecure123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE ESTADÍSTICAS DE USUARIO
# ═══════════════════════════════════════════════════════════════════════════════
class StatsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.stats_url = reverse('user_stats')

        reg = self.client.post(self.register_url, {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        self.token = reg.data.get('access_token', '')

    def test_stats_autenticado_sin_partidas(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_partidas'], 0)

    def test_stats_sin_auth(self):
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stats_con_partidas(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        user = Usuario.objects.get(username='testuser')
        nivel = Nivel.objects.create(nombre='Nivel Stats', dificultad='facil')
        Partida.objects.create(usuario=user, nivel=nivel, muertes=2, tiempo=100, puntuacion=600)
        Partida.objects.create(usuario=user, nivel=nivel, muertes=1, tiempo=80, puntuacion=900)

        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_partidas'], 2)
        self.assertEqual(response.data['mejor_puntuacion'], 900)
        self.assertEqual(response.data['peor_puntuacion'], 600)
        self.assertEqual(response.data['nivel_favorito'], 'Nivel Stats')


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE INTEGRACIÓN: FLUJO COMPLETO DE USUARIO
# ═══════════════════════════════════════════════════════════════════════════════
class FlujoIntegracionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.logout_url = reverse('logout')
        self.verify_url = reverse('verify_session')
        self.refresh_url = reverse('token_refresh')
        self.nivel_list_url = reverse('nivel_list')
        self.partida_list_url = reverse('partida_list')
        self.stats_url = reverse('user_stats')
        self.change_pw_url = reverse('change_password')
        self.ranking_url = reverse('ranking')

    def test_flujo_completo_usuario(self):
        # 1. Registrar usuario
        reg = self.client.post(self.register_url, {
            'username': 'integration_user',
            'email': 'integration@gmail.com',
            'password': 'SecurePass123!',
            'confirm_password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED)
        token = reg.data['access_token']

        # 2. Verificar sesión
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        verify = self.client.get(self.verify_url)
        self.assertEqual(verify.status_code, status.HTTP_200_OK)

        # 3. Login (obtener refresh cookie)
        login = self.client.post(self.login_url, {
            'username': 'integration_user',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)

        # 4. Listar niveles (público)
        niveles = self.client.get(self.nivel_list_url)
        self.assertEqual(niveles.status_code, status.HTTP_200_OK)

        # 5. Crear partida
        nivel = Nivel.objects.create(nombre='Nivel Integración', dificultad='medio')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        partida = self.client.post(self.partida_list_url, {
            'nivel': nivel.pk,
            'muertes': 2,
            'tiempo': 90,
            'puntuacion': 750,
        }, format='json')
        self.assertEqual(partida.status_code, status.HTTP_201_CREATED)

        # 6. Ver estadísticas
        stats = self.client.get(self.stats_url)
        self.assertEqual(stats.status_code, status.HTTP_200_OK)
        self.assertEqual(stats.data['total_partidas'], 1)
        self.assertEqual(stats.data['mejor_puntuacion'], 750)

        # 7. Ranking público
        ranking = self.client.get(self.ranking_url)
        self.assertEqual(ranking.status_code, status.HTTP_200_OK)
        self.assertGreater(len(ranking.data), 0)

        # 8. Refresh token
        refresh = self.client.post(self.refresh_url, {
            'refresh_token': str(
                __import__('rest_framework_simplejwt.tokens', fromlist=['RefreshToken'])
                .RefreshToken.for_user(Usuario.objects.get(username='integration_user'))
            ),
        }, format='json')
        self.assertEqual(refresh.status_code, status.HTTP_200_OK)
        new_token = refresh.data['access_token']

        # 9. Verificar sesión con nuevo token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_token}')
        verify2 = self.client.get(self.verify_url)
        self.assertEqual(verify2.status_code, status.HTTP_200_OK)

        # 10. Cambiar contraseña
        change = self.client.post(self.change_pw_url, {
            'old_password': 'SecurePass123!',
            'new_password': 'NewSecure456!',
            'confirm_password': 'NewSecure456!',
        }, format='json')
        self.assertEqual(change.status_code, status.HTTP_200_OK)

        # 11. Login con nueva contraseña
        login2 = self.client.post(self.login_url, {
            'username': 'integration_user',
            'password': 'NewSecure456!',
        }, format='json')
        self.assertEqual(login2.status_code, status.HTTP_200_OK)

        # 12. Logout
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_token}')
        logout = self.client.post(self.logout_url, {}, format='json')
        self.assertEqual(logout.status_code, status.HTTP_200_OK)

    def test_flujo_completo_admin(self):
        # Crear admin
        admin = Usuario.objects.create_superuser(
            username='admin_integ',
            email='admin_integ@gmail.com',
            password='AdminPass123!',
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        admin_token = str(RefreshToken.for_user(admin).access_token)

        # Crear nivel como admin
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        nivel_resp = self.client.post(self.nivel_list_url, {
            'nombre': 'Nivel Admin',
            'dificultad': 'dificil',
            'tiempo_limite': 180,
        }, format='json')
        self.assertEqual(nivel_resp.status_code, status.HTTP_201_CREATED)

        # Admin stats
        admin_stats = self.client.get(reverse('admin_stats'))
        self.assertEqual(admin_stats.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_stats.data['total_niveles'], 1)

        # Admin partidas
        admin_partidas = self.client.get(reverse('admin_partidas'))
        self.assertEqual(admin_partidas.status_code, status.HTTP_200_OK)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE EDGE CASES - NIVEL
# ═══════════════════════════════════════════════════════════════════════════════
class NivelEdgeCaseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.nivel_list_url = reverse('nivel_list')
        self.nivel_detail_url = lambda pk: reverse('nivel_detail', args=[pk])
        self.nivel = Nivel.objects.create(
            nombre='Nivel Test',
            dificultad='facil',
            tiempo_limite=120,
        )

    def test_nivel_detail_no_existe(self):
        admin = Usuario.objects.create_superuser(
            username='admin_detail', email='admin_detail@gmail.com', password='Admin123!'
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(admin).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        url = self.nivel_detail_url(9999)
        response = self.client.get(url)
        # NivelDetailView no soporta GET (solo PUT/DELETE), retorna 405
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED])

    def test_nivel_create_campos_requeridos(self):
        admin = Usuario.objects.create_superuser(
            username='admin', email='admin@gmail.com', password='Admin123!'
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(admin).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Sin nombre
        resp = self.client.post(self.nivel_list_url, {
            'dificultad': 'medio',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nivel_create_dificultad_invalida(self):
        admin = Usuario.objects.create_superuser(
            username='admin', email='admin@gmail.com', password='Admin123!'
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(admin).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        resp = self.client.post(self.nivel_list_url, {
            'nombre': 'Nivel',
            'dificultad': 'extrema',  # valor no válido
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nivel_update_no_existe(self):
        admin = Usuario.objects.create_superuser(
            username='admin', email='admin@gmail.com', password='Admin123!'
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(admin).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        url = self.nivel_detail_url(9999)
        resp = self.client.put(url, {'nombre': 'X'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_nivel_delete_no_existe(self):
        admin = Usuario.objects.create_superuser(
            username='admin', email='admin@gmail.com', password='Admin123!'
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(admin).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        url = self.nivel_detail_url(9999)
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE EDGE CASES - PARTIDA
# ═══════════════════════════════════════════════════════════════════════════════
class PartidaEdgeCaseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.partida_list_url = reverse('partida_list')
        self.partida_detail_url = lambda pk: reverse('partida_detail', args=[pk])

        reg = self.client.post(reverse('register'), {
            'username': 'user1',
            'email': 'user1@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        self.token = reg.data.get('access_token', '')
        self.nivel = Nivel.objects.create(nombre='Nivel', dificultad='facil')

    def test_crear_partida_nivel_no_existe(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.post(self.partida_list_url, {
            'nivel': 9999,
            'muertes': 0,
            'tiempo': 60,
            'puntuacion': 100,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_partida_muertes_negativas(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.post(self.partida_list_url, {
            'nivel': self.nivel.pk,
            'muertes': -1,
            'tiempo': 60,
            'puntuacion': 100,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_partida_puntuacion_negativa(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.post(self.partida_list_url, {
            'nivel': self.nivel.pk,
            'muertes': 0,
            'tiempo': 60,
            'puntuacion': -100,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_partida_cero_muertes(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.post(self.partida_list_url, {
            'nivel': self.nivel.pk,
            'muertes': 0,
            'tiempo': 30,
            'puntuacion': 1000,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_partida_detail_no_existe(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.get(self.partida_detail_url(9999))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_partida_detail_otro_usuario(self):
        # Crear otra partida como user1
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.post(self.partida_list_url, {
            'nivel': self.nivel.pk,
            'muertes': 1,
            'tiempo': 60,
            'puntuacion': 500,
        }, format='json')
        partida_id = resp.data['id']

        # Registrar user2
        reg2 = self.client.post(reverse('register'), {
            'username': 'user2',
            'email': 'user2@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        token2 = reg2.data.get('access_token', '')

        # user2 intenta ver la partida de user1 → 403
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token2}')
        resp2 = self.client.get(self.partida_detail_url(partida_id))
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_partidas_aislamiento(self):
        # user1 crea partida
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        self.client.post(self.partida_list_url, {
            'nivel': self.nivel.pk, 'muertes': 0, 'tiempo': 60, 'puntuacion': 100,
        }, format='json')

        # user2 no ve las partidas de user1
        reg2 = self.client.post(reverse('register'), {
            'username': 'user2_iso',
            'email': 'user2_iso@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        token2 = reg2.data.get('access_token', '')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token2}')
        resp = self.client.get(self.partida_list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # user2 no tiene partidas, debe retornar lista vacía (paginated)
        self.assertEqual(len(resp.data.get('results', [])), 0)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE PERMISOS DETALLADOS
# ═══════════════════════════════════════════════════════════════════════════════
class PermisosDetalladosTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')

        reg = self.client.post(self.register_url, {
            'username': 'normal_user',
            'email': 'normal@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        self.user_token = reg.data.get('access_token', '')

        self.admin = Usuario.objects.create_superuser(
            username='admin_user',
            email='admin_perm@gmail.com',
            password='AdminPass123!',
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)

    def test_usuario_list_requiere_admin(self):
        # Normal user → 403
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        resp = self.client.get(reverse('usuario_list'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_list_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        resp = self.client.get(reverse('usuario_list'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_usuario_detail_otro_usuario_normal(self):
        # Normal user intenta ver perfil de admin → 403
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        resp = self.client.get(reverse('usuario_detail', args=[self.admin.pk]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_detail_propio_perfil(self):
        user = Usuario.objects.get(username='normal_user')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        resp = self.client.get(reverse('usuario_detail', args=[user.pk]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_usuario_detail_admin_ve_cualquier_usuario(self):
        user = Usuario.objects.get(username='normal_user')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        resp = self.client.get(reverse('usuario_detail', args=[user.pk]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_usuario_detail_no_existe(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        resp = self.client.get(reverse('usuario_detail', args=[9999]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_partidas_requiere_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        resp = self.client.get(reverse('admin_partidas'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_partidas_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        resp = self.client.get(reverse('admin_partidas'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_admin_stats_requiere_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        resp = self.client.get(reverse('admin_stats'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_stats_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        resp = self.client.get(reverse('admin_stats'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('total_usuarios', resp.data)
        self.assertIn('total_partidas', resp.data)

    def test_usuario_desactivar_por_admin(self):
        user = Usuario.objects.get(username='normal_user')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        resp = self.client.delete(reverse('usuario_detail', args=[user.pk]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_usuario_normal_no_puede_desactivar(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        admin_user = Usuario.objects.get(username='admin_user')
        resp = self.client.delete(reverse('usuario_detail', args=[admin_user.pk]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_no_puede_desactivarse_a_si_mismo(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        resp = self.client.delete(reverse('usuario_detail', args=[self.admin.pk]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_admin_puede_cambiar_rol(self):
        user = Usuario.objects.get(username='normal_user')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        resp = self.client.put(reverse('usuario_detail', args=[user.pk]), {
            'username': 'normal_user',
            'email': 'normal@gmail.com',
            'rol': 'admin',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.rol, 'admin')

    def test_admin_puede_degradar_rol(self):
        user = Usuario.objects.get(username='normal_user')
        user.rol = 'admin'
        user.save(update_fields=['rol'])
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        resp = self.client.put(reverse('usuario_detail', args=[user.pk]), {
            'username': 'normal_user',
            'email': 'normal@gmail.com',
            'rol': 'jugador',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.rol, 'jugador')

    def test_usuario_normal_no_puede_cambiarse_rol(self):
        user = Usuario.objects.get(username='normal_user')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        resp = self.client.put(reverse('usuario_detail', args=[user.pk]), {
            'username': 'normal_user',
            'email': 'normal@gmail.com',
            'rol': 'admin',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertEqual(user.rol, 'jugador')

    def test_usuario_normal_no_puede_cambiar_rol_de_otro(self):
        other = Usuario.objects.create_user(
            username='victima',
            email='victima@gmail.com',
            password='TestPass123!',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        resp = self.client.put(reverse('usuario_detail', args=[other.pk]), {
            'username': 'victima',
            'email': 'victima@gmail.com',
            'rol': 'admin',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        other.refresh_from_db()
        self.assertEqual(other.rol, 'jugador')


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE VERIFICACIÓN DE SESIÓN
# ═══════════════════════════════════════════════════════════════════════════════
class VerifySessionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.verify_url = reverse('verify_session')
        reg = self.client.post(reverse('register'), {
            'username': 'verify_user',
            'email': 'verify@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        self.token = reg.data.get('access_token', '')

    def test_verify_session_valido(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        resp = self.client.get(self.verify_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_verify_session_sin_token(self):
        resp = self.client.get(self.verify_url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_verify_session_token_invalido(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer token_falso')
        resp = self.client.get(self.verify_url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE Aislamiento de Stats
# ═══════════════════════════════════════════════════════════════════════════════
class StatsAislamientoTests(TestCase):
    def test_stats_no_muestra_otro_usuario(self):
        client = APIClient()
        nivel = Nivel.objects.create(nombre='Nivel Iso', dificultad='facil')

        # user1 crea partidas
        reg1 = client.post(reverse('register'), {
            'username': 'iso_user1',
            'email': 'iso1@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        token1 = reg1.data.get('access_token', '')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token1}')
        client.post(reverse('partida_list'), {
            'nivel': nivel.pk, 'muertes': 5, 'tiempo': 120, 'puntuacion': 300,
        }, format='json')

        # user2 no tiene partidas
        reg2 = client.post(reverse('register'), {
            'username': 'iso_user2',
            'email': 'iso2@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        token2 = reg2.data.get('access_token', '')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token2}')
        resp = client.get(reverse('user_stats'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['total_partidas'], 0)

    def test_ranking_muestra_ambos(self):
        client = APIClient()
        nivel = Nivel.objects.create(nombre='Nivel Rank Iso', dificultad='medio')

        # user1
        reg1 = client.post(reverse('register'), {
            'username': 'rank_iso1',
            'email': 'rank1@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        token1 = reg1.data.get('access_token', '')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token1}')
        client.post(reverse('partida_list'), {
            'nivel': nivel.pk, 'muertes': 2, 'tiempo': 90, 'puntuacion': 500,
        }, format='json')

        # user2
        reg2 = client.post(reverse('register'), {
            'username': 'rank_iso2',
            'email': 'rank2@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }, format='json')
        token2 = reg2.data.get('access_token', '')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token2}')
        client.post(reverse('partida_list'), {
            'nivel': nivel.pk, 'muertes': 1, 'tiempo': 60, 'puntuacion': 800,
        }, format='json')

        # Ranking debe mostrar ambos
        ranking = client.get(reverse('ranking'))
        usernames = [r['username'] for r in ranking.data]
        self.assertIn('rank_iso1', usernames)
        self.assertIn('rank_iso2', usernames)


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE RESILIENCIA DE CACHÉ
# ═══════════════════════════════════════════════════════════════════════════════
class CacheResilienciaTests(TestCase):
    def test_fallback_con_redis_caido_no_rompe_operaciones(self):
        from api.cache_backend import ResilientRedisCache

        # Puerto muerto: cualquier operación contra Redis lanzará excepción.
        cache = ResilientRedisCache('redis://127.0.0.1:6399/0', {})

        cache.set('clave', 42)
        self.assertEqual(cache.get('clave'), 42)
        self.assertTrue(cache.add('otra', 1))
        self.assertEqual(cache.get('otra'), 1)
        cache.delete('clave')
        self.assertIsNone(cache.get('clave'))
        self.assertTrue(cache.has_key('otra'))


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE SEGURIDAD DEL PANEL DE ADMINISTRACIÓN
# ═══════════════════════════════════════════════════════════════════════════════
# El login de Django admin no cuenta con protección anti fuerza bruta propia
# (falla con 200, no 401/403). SecureAdminSite añade rate limit DRF por IP y
# lockout con los mismos umbrales que /api/login/. Estas tests validan ambas
# capas sin depender del BruteForceIPMiddleware (que no se carga en tests).

@override_settings(ROOT_URLCONF='api.urls_admin_test')
class AdminSeguridadTests(TestCase):
    def setUp(self):
        django_cache.clear()
        self.login_url = '/admin/login/'
        self.admin = Usuario.objects.create_user(
            username='root',
            email='root@gmail.com',
            password='AdminPass123!',
            rol='admin',
        )
        self._rate_admin_login = django_settings.REST_FRAMEWORK[
            'DEFAULT_THROTTLE_RATES'
        ].get('admin_login')

    def tearDown(self):
        django_settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['admin_login'] = (
            self._rate_admin_login
        )
        django_cache.clear()

    def _post_login(self, password='mala', username='root'):
        return self.client.post(
            self.login_url,
            {'username': username, 'password': password},
        )

    def test_login_admin_valido_redirige(self):
        # El form de login de Django admin incluye un campo hidden 'next'
        # apuntando al índice del admin; sin él, LoginView caería al
        # LOGIN_REDIRECT_URL por defecto.
        response = self.client.post(
            self.login_url,
            {'username': 'root', 'password': 'AdminPass123!', 'next': '/admin/'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/admin/')

    def test_credenciales_incorrectas_renderiza_200(self):
        # Django admin devuelve 200 en fallo: por eso SecureAdminSite registra
        # el fallo explícitamente (el middleware no lo detecta por status).
        response = self._post_login(password='incorrecta')
        self.assertEqual(response.status_code, 200)

    def test_rate_limit_login_admin_bloquea_intentos_adicionales(self):
        # Ritmo reducido solo para este test: 2 permitidos y el 3º se corta
        # ANTES de intentar autenticar (no consume credenciales).
        django_settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['admin_login'] = '2/minute'
        for _ in range(2):
            response = self._post_login(password='incorrecta')
            self.assertEqual(response.status_code, 200)
            self.assertNotContains(response, 'Demasiados intentos de inicio de sesión')

        response = self._post_login(password='incorrecta')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Demasiados intentos de inicio de sesión')

    def test_lockout_ip_tras_max_intentos(self):
        # Con el ritmo por defecto de tests (relajado) se cuentan los fallos
        # reales: al llegar a MAX_ATTEMPTS la IP queda en lockout y el POST
        # siguiente no intenta autenticar.
        for _ in range(BruteForceIPMiddleware.MAX_ATTEMPTS):
            response = self._post_login(password='incorrecta')
            self.assertEqual(response.status_code, 200)
            self.assertNotContains(response, 'bloqueada')

        self.assertTrue(BruteForceIPMiddleware.ip_bloqueada('127.0.0.1'))

        response = self._post_login(password='incorrecta')
        self.assertContains(response, 'bloqueada')

    def test_ip_distinta_no_esta_bloqueada(self):
        # Sanity: los fallos se cuentan por IP y prefijo de path concretos.
        self.assertFalse(BruteForceIPMiddleware.ip_bloqueada('8.8.8.8'))
