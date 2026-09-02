# ─── IMPORTACIONES ───────────────────────────────────────────────────────────
# TestCase de Django: clase base para tests unitarios con base de datos
# de prueba aislada (se crea y destruye automáticamente por cada test)
from django.test import TestCase

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


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DE REGISTRO DE USUARIO
# ═══════════════════════════════════════════════════════════════════════════════
# Valida todo el flujo de registro: desde el caso exitoso hasta各种
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
        self.user_data = {
            'username': 'testuser',
            'email': 'test@gmail.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        self.client.post(self.register_url, self.user_data, format='json')

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
        # Solicita reset para generar un token
        self.client.post(self.reset_url, {'email': 'test@gmail.com'}, format='json')
        record = ConfirmacionReset.objects.first()
        # Token en texto plano: se usa para encontrar el registro por su hash
        token = 'fake_token_for_test'
        token_hash = __import__('hashlib').sha256(token.encode()).hexdigest()
        record.token_hash = token_hash
        record.save()

        response = self.client.post(self.confirm_url, {
            'token': token,
            'password': 'NewPass123!',
            'confirm_password': 'NewPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verificar que la contraseña cambió
        usuario = Usuario.objects.get(username='testuser')
        self.assertTrue(usuario.check_password('NewPass123!'))

    def test_confirm_reset_passwords_no_coinciden(self):
        self.client.post(self.reset_url, {'email': 'test@gmail.com'}, format='json')
        record = ConfirmacionReset.objects.first()
        token = 'fake_token_for_test'
        token_hash = __import__('hashlib').sha256(token.encode()).hexdigest()
        record.token_hash = token_hash
        record.save()

        response = self.client.post(self.confirm_url, {
            'token': token,
            'password': 'NewPass123!',
            'confirm_password': 'DifferentPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_password_debil(self):
        self.client.post(self.reset_url, {'email': 'test@gmail.com'}, format='json')
        record = ConfirmacionReset.objects.first()
        token = 'fake_token_for_test'
        token_hash = __import__('hashlib').sha256(token.encode()).hexdigest()
        record.token_hash = token_hash
        record.save()

        response = self.client.post(self.confirm_url, {
            'token': token,
            'password': '123',
            'confirm_password': '123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_token_expirado(self):
        from django.utils import timezone as tz
        self.client.post(self.reset_url, {'email': 'test@gmail.com'}, format='json')
        record = ConfirmacionReset.objects.first()
        # Forzar expiración: retroceder la fecha de creación 20 minutos
        record.created_at = tz.now() - tz.timedelta(minutes=20)
        record.save()

        response = self.client.post(self.confirm_url, {
            'token': 'any_token',
            'password': 'NewPass123!',
            'confirm_password': 'NewPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_token_inexistente(self):
        response = self.client.post(self.confirm_url, {
            'token': 'token_que_no_existe_999',
            'password': 'NewPass123!',
            'confirm_password': 'NewPass123!',
        }, format='json')
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
        # Crear datos de prueba: usuario, nivel y partidas
        from rest_framework_simplejwt.tokens import RefreshToken
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
