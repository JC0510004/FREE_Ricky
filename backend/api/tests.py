from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from .models import Usuario


class RegistroTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('register')
        self.valid_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }

    def test_registro_exitoso(self):
        response = self.client.post(self.url, self.valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access_token', response.data)
        self.assertIn('refresh_token', response.data)
        self.assertEqual(response.data['usuario']['username'], 'testuser')

    def test_registro_password_debil(self):
        data = {**self.valid_data, 'password': '123', 'confirm_password': '123'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_email_invalido(self):
        data = {**self.valid_data, 'email': 'no-email'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_username_invalido(self):
        data = {**self.valid_data, 'username': '<script>'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_password_no_coinciden(self):
        data = {**self.valid_data, 'confirm_password': 'otraPass123!'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_duplicado(self):
        self.client.post(self.url, self.valid_data, format='json')
        response = self.client.post(self.url, self.valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_sin_campos(self):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_no_expuesta(self):
        response = self.client.post(self.url, self.valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', response.data.get('usuario', {}))

    def test_xss_en_username(self):
        data = {**self.valid_data, 'username': '<script>alert(1)</script>'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.credentials = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        self.client.post(self.register_url, self.credentials, format='json')

    def test_login_exitoso(self):
        response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', response.data)
        self.assertIn('refresh_token', response.data)
        self.assertIn('usuario', response.data)

    def test_login_con_email(self):
        response = self.client.post(self.login_url, {
            'username': 'test@example.com',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_login_password_incorrecta(self):
        response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'WrongPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)

    def test_login_usuario_inexistente(self):
        response = self.client.post(self.login_url, {
            'username': 'noexiste12345',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['error'], 'Credenciales incorrectas')

    def test_proteccion_enumeracion(self):
        resp_no_user = self.client.post(self.login_url, {
            'username': 'usuario_que_no_existe_999',
            'password': 'TestPass123!',
        }, format='json')
        resp_wrong_pass = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'WrongPass' + 'X' * 10,
        }, format='json')
        self.assertEqual(
            resp_no_user.data.get('error', ''),
            resp_wrong_pass.data.get('error', ''),
        )


class ProteccionEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        reg = self.client.post(self.register_url, self.data, format='json')
        self.token = reg.data.get('access_token', '')

    def test_usuarios_list_requiere_auth(self):
        url = reverse('usuario_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_usuarios_detail_requiere_auth(self):
        url = reverse('usuario_detail', args=[1])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_requiere_auth(self):
        url = reverse('logout')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ranking_publico(self):
        url = reverse('public_ranking')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_usuarios_list_requiere_admin(self):
        url = reverse('usuario_list')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        # Usuario normal sin rol admin debe recibir 403
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class PasswordHashingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('register')
        self.data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }

    def test_password_no_almacenada_texto_plano(self):
        self.client.post(self.url, self.data, format='json')
        usuario = Usuario.objects.get(username='testuser')
        self.assertNotEqual(usuario.password, 'TestPass123!')
        self.assertTrue(usuario.password.startswith('argon2'))

    def test_verificacion_password(self):
        self.client.post(self.url, self.data, format='json')
        usuario = Usuario.objects.get(username='testuser')
        self.assertTrue(usuario.check_password('TestPass123!'))
        self.assertFalse(usuario.check_password('WrongPass123!'))


class BruteForceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
        }
        self.client.post(self.register_url, self.data, format='json')

    def test_incremento_intentos_fallidos(self):
        for i in range(5):
            self.client.post(self.login_url, {
                'username': 'testuser',
                'password': 'WrongPass123!',
            }, format='json')
        usuario = Usuario.objects.get(username='testuser')
        self.assertEqual(usuario.failed_attempts, 5)
        self.assertIsNotNone(usuario.locked_until)

    def test_bloqueo_por_intentos(self):
        for _ in range(5):
            self.client.post(self.login_url, {
                'username': 'testuser',
                'password': 'WrongPass123!',
            }, format='json')
        response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('bloqueada', response.data.get('error', '').lower())

    def test_reset_intentos_tras_login_exitoso(self):
        for _ in range(3):
            self.client.post(self.login_url, {
                'username': 'testuser',
                'password': 'WrongPass123!',
            }, format='json')
        usuario_antes = Usuario.objects.get(username='testuser')
        self.assertEqual(usuario_antes.failed_attempts, 3)

        response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        usuario_despues = Usuario.objects.get(username='testuser')
        self.assertEqual(usuario_despues.failed_attempts, 0)
        self.assertIsNone(usuario_despues.locked_until)
