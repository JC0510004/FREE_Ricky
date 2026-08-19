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
from .models import Usuario


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
