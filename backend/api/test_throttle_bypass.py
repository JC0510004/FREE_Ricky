# ─── IMPORTACIONES ───────────────────────────────────────────────────────────
# TestCase de Django: base de datos de prueba aislada por test.
from django.test import TestCase
from django.core.cache import cache as django_cache
from django.conf import settings as django_settings

# reverse: resuelve URLs por nombre en vez de hardcodear paths.
from django.urls import reverse

# Códigos de estado de DRF para assertions legibles.
from rest_framework import status

# APIClient: simula peticiones HTTP sin levantar servidor.
from rest_framework.test import APIClient

from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle

# Resuelve las rutas de 'DEFAULT_THROTTLE_CLASSES', que son strings tipo
# 'rest_framework.throttling.AnonRateThrottle', a la clase que nombran.
import importlib

from .models import Usuario
from .throttles import PublicIPThrottle


# ═══════════════════════════════════════════════════════════════════════════════
# REGRESIÓN: LOS THROTTLES PÚBLICOS NO SE ESQUIVAN AUTENTICÁNDOSE
# ═══════════════════════════════════════════════════════════════════════════════
#
# El ataque, en una frase: `AnonRateThrottle` de DRF devuelve `None` desde
# `get_cache_key()` en cuanto la petición llega autenticada, y `allow_request()`
# deja pasar todo lo que no tenga clave. Como DRF ejecuta la autenticación ANTES
# que `check_throttles()`, basta con registrarse una vez y adjuntar el JWT para
# obtener cuota ilimitada en cualquier endpoint público.
#
# Ya había tests para login, register y password_reset (ThrottleBypassTests en
# tests.py). Faltaban los dos del final del flujo de reset, que se quedaron con
# `AnonRateThrottle` y por tanto ilimitados. Este fichero cubre esos dos y, sobre
# todo, los dos tests de Invariante: son los que impiden que el bug vuelva a
# colarse por una vista nueva o por un cambio en la configuración por defecto.
#
# Reproducido contra la app en marcha antes del arreglo: 70 peticiones a
# /api/password-reset/verificar/ con JWT gave 70×200 y 0×429, mientras que sin
# JWT saltaba el 429 en la 61ª.
class ThrottleNoEvadibleTests(TestCase):
    def setUp(self):
        django_cache.clear()
        self.usuario = Usuario.objects.create_user(
            username='atacante',
            email='atacante@example.com',
            password='AtacantePass123!',
        )
        # Copia de las cuotas vigentes para restaurarlas al terminar.
        self._rates = dict(django_settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'])
        self.client = APIClient()

    def tearDown(self):
        django_settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update(self._rates)
        django_cache.clear()

    def _cuota(self, scope, rate):
        django_settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'][scope] = rate

    def _autenticar(self):
        """Atacante con cuenta propia y sesión válida: no hay bypass de credenciales.

        `force_authenticate` reproduce exactamente el estado que dispara el fallo
        (`request.user.is_authenticated` a True) sin gastar la cuota de login,
        que si se compartiera contaminaría la medición.
        """
        self.client.force_authenticate(user=self.usuario)

    # ─── Los dos endpoints que se habían quedado fuera ──────────────────────

    def test_confirmar_identidad_no_se_esquiva_con_jwt_valido(self):
        """POST /api/password-reset/confirmar/ marca el token como confirmado.

        Es el endpoint seriouso de los dos: sin tope, "tener el token" deja de ser
        un requisito difícil, porque se pueden probar confirmaciones sin límite.
        """
        self._cuota('password_reset_confirmar', '2/minute')
        self._autenticar()

        for _ in range(2):
            response = self.client.post(
                reverse('password_reset_confirmar'),
                {'token': 'token-inexistente'},
                format='json',
            )
            self.assertNotEqual(
                response.status_code,
                status.HTTP_429_TOO_MANY_REQUESTS,
            )

        response = self.client.post(
            reverse('password_reset_confirmar'),
            {'token': 'token-inexistente'},
            format='json',
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            'Confirmar la identidad desde el enlace no puede quedar ilimitado '
            'para quien va autenticado',
        )

    def test_verificar_confirmacion_no_se_esquiva_con_jwt_valido(self):
        """GET /api/password-reset/verificar/ es un oráculo de validez de tokens."""
        self._cuota('password_reset_verificar', '2/minute')
        self._autenticar()

        for _ in range(2):
            response = self.client.get(
                reverse('password_reset_verificar'),
                {'token': 'token-inexistente'},
            )
            self.assertNotEqual(
                response.status_code,
                status.HTTP_429_TOO_MANY_REQUESTS,
            )

        response = self.client.get(
            reverse('password_reset_verificar'),
            {'token': 'token-inexistente'},
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            'Consultar el estado de un token no puede quedar ilimitado '
            'para quien va autenticado',
        )

    def test_anonimo_y_autenticado_comparten_cuota_en_confirmar(self):
        """La cuota es por IP: autenticarse no 'reinicia' el contador."""
        self._cuota('password_reset_confirmar', '2/minute')

        for _ in range(2):
            self.client.post(
                reverse('password_reset_confirmar'),
                {'token': 'token-inexistente'},
                format='json',
            )

        self._autenticar()
        response = self.client.post(
            reverse('password_reset_confirmar'),
            {'token': 'token-inexistente'},
            format='json',
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            'Agotar la cuota como anónimo debe seguir valiendo al autenticarse',
        )


# ═══════════════════════════════════════════════════════════════════════════════
# CUOTA DEL REENVÍO DE VERIFICACIÓN: POR IDENTIDAD, NO POR IP
# ═══════════════════════════════════════════════════════════════════════════════
#
# `reenviar_verificacion` estuvo con PublicIPThrottle (siempre por IP). Con el
# endpoint vuelto público (acepta un email sin sesión) la cuota por IP dejó de
# describir el flujo real: detras de nginx todas las IPs de una misma LAN llegan
# con el mismo REMOTE_ADDR (el del proxy), así que un único balde de 5/hora
# compartía los reenvíos de toda la red, y además los intentos anónimos (incluso
# para correos que no existen) lo agotaban y bloqueaban el reenvío legítimo una
# hora entera. La cuota pasó a ser por identidad: usuario autenticado (su balde)
# o IP cuando es anónimo. Estos tests fijan ese reparto.
class ReenviarVerificacionPorIdentidadTests(TestCase):
    def setUp(self):
        django_cache.clear()
        self.usuario_a = Usuario.objects.create_user(
            username='reenvio-a',
            email='reenvio-a@example.com',
            password='AtacantePass123!',
        )
        self.usuario_b = Usuario.objects.create_user(
            username='reenvio-b',
            email='reenvio-b@example.com',
            password='AtacantePass123!',
        )
        self._rates = dict(django_settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'])
        self.client = APIClient()

    def tearDown(self):
        django_settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update(self._rates)
        django_cache.clear()

    def _cuota(self, scope, rate):
        django_settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'][scope] = rate

    def _reenviar(self):
        return self.client.post(reverse('reenviar_verificacion'), {}, format='json')

    def test_autenticado_agota_su_propia_cuota(self):
        """Con sesión el balde es del usuario: tras el cupo toca 429."""
        self._cuota('reenviar_verificacion', '2/minute')
        self.client.force_authenticate(user=self.usuario_a)

        for _ in range(2):
            self.assertNotEqual(
                self._reenviar().status_code,
                status.HTTP_429_TOO_MANY_REQUESTS,
            )
        self.assertEqual(
            self._reenviar().status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            'El usuario autenticado no puede reenviar sin limite',
        )

    def test_usuarios_distintos_no_comparten_cuota(self):
        """Agotar el balde de A no bloquea a B."""
        self._cuota('reenviar_verificacion', '2/minute')
        self.client.force_authenticate(user=self.usuario_a)
        for _ in range(2):
            self._reenviar()
        self.assertEqual(self._reenviar().status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        self.client.force_authenticate(user=self.usuario_b)
        self.assertNotEqual(
            self._reenviar().status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            'La cuota es por usuario: un usuario no puede bloquear el reenvio de otro',
        )

    def test_anonimo_agota_su_cuota_por_ip(self):
        """Sin sesión la cuota es por IP, y un intento anónimo también consume."""
        self._cuota('reenviar_verificacion', '2/minute')
        for _ in range(2):
            self.client.post(
                reverse('reenviar_verificacion'),
                {'email': 'nadie@example.com'},
                format='json',
            )
        response = self.client.post(
            reverse('reenviar_verificacion'),
            {'email': 'nadie@example.com'},
            format='json',
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            'El reenvío anónimo también tiene tope por IP',
        )

    def test_anonimo_y_autenticado_tienen_baldes_separados(self):
        """Agotar el balde anónimo de la IP no bloquea al usuario con sesión.

        Es la diferencia deliberada con el resto de endpoints públicos: el reenvío
        con sesión es del usuario, así que el banner no muere porque la LAN gastó
        la cuota anónima de la IP.
        """
        self._cuota('reenviar_verificacion', '2/minute')
        for _ in range(2):
            self.client.post(
                reverse('reenviar_verificacion'),
                {'email': 'nadie@example.com'},
                format='json',
            )
        self.assertEqual(
            self.client.post(
                reverse('reenviar_verificacion'),
                {'email': 'nadie@example.com'},
                format='json',
            ).status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

        self.client.force_authenticate(user=self.usuario_a)
        self.assertNotEqual(
            self._reenviar().status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            'Agotar la cuota anónima de la IP no puede bloquear el reenvío con sesión',
        )

    def test_agotar_balde_de_usuario_no_bloquea_anonimo_de_la_misma_ip(self):
        """La dirección inversa: la cuota del usuario no toca el balde anónimo IP."""
        self._cuota('reenviar_verificacion', '2/minute')
        self.client.force_authenticate(user=self.usuario_a)
        for _ in range(2):
            self._reenviar()
        self.assertEqual(self._reenviar().status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        self.client.force_authenticate(user=None)
        self.assertNotEqual(
            self.client.post(
                reverse('reenviar_verificacion'),
                {'email': 'nadie@example.com'},
                format='json',
            ).status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            'Gastar el balde del usuario no puede bloquear los reenvíos anónimos de la IP',
        )


# ═══════════════════════════════════════════════════════════════════════════════
# INVARIANTES: por qué existen estos dos tests
# ═══════════════════════════════════════════════════════════════════════════════
#
# Los tests de arriba comprueban dos endpoints concretos. Estos dos comprueban la
# REGLA, y son los que de verdad evitan la recaída: el bug volvió porque nadie
# miró la lista completa de vistas, así que ahora la lista completa se mira sola.
class ThrottleInvariantesTests(TestCase):
    def _vistas_del_proyecto(self):
        """Todas las APIView del proyecto, deduplicadas por clase."""
        import api.views_auth
        import api.views_email
        import api.views_password_reset
        import api.views_users

        vistas = set()
        for modulo in (
            api.views_auth,
            api.views_email,
            api.views_password_reset,
            api.views_users,
        ):
            for atributo in vars(modulo).values():
                if (
                    isinstance(atributo, type)
                    and issubclass(atributo, APIView)
                    and atributo is not APIView
                ):
                    vistas.add(atributo)
        return vistas

    def test_ninguna_vista_usa_anonratethrottle(self):
        """Ninguna vista debe declarar `AnonRateThrottle` en sus throttle_classes.

        El fallo original no fue un error de lógica sino de inventario: las vistas
        ya arregladas eran correctas y las dos del final del flujo de reset se
        quedaron con la clase de DRF porque nadie las revisó. Este test recorre
        todas las vistas, así que una vista nueva con `AnonRateThrottle` rompe la
        suite en vez de pasar desapercibida hasta el próximo pentest.
        """
        infractores = []
        for vista in self._vistas_del_proyecto():
            for throttle in getattr(vista, 'throttle_classes', []):
                # Se comparan las clases concretas Y sus bases: una subclase
                # propia de AnonRateThrottle seguiría siendo evadible.
                if isinstance(throttle, type) and issubclass(throttle, AnonRateThrottle):
                    infractores.append(f'{vista.__module__}.{vista.__name__} -> {throttle.__name__}')

        self.assertEqual(
            infractores,
            [],
            'Estas vistas usan AnonRateThrottle, evadible autenticándose: '
            + '; '.join(infractores),
        )

    def test_default_throttle_classes_no_es_evadible(self):
        """La clase por defecto tampoco puede ser AnonRateThrottle.

        Cubre el caso distinto de una vista nueva que no declare throttle_classes:
        hereda estos valores, y con AnonRateThrottle sería ilimitada para quien
        vaya autenticado sin haber escrito una sola línea de código.
        """
        evadibles = []
        for ruta in django_settings.REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES']:
            if isinstance(ruta, str):
                # 'api.throttles.PublicIPThrottle' o 'rest_framework...AnonRateThrottle'
                partes = ruta.rsplit('.', 1)
                try:
                    modulo = importlib.import_module(partes[0])
                    clase = getattr(modulo, partes[1])
                except (ImportError, AttributeError, ValueError):
                    continue
            else:
                clase = ruta

            if issubclass(clase, AnonRateThrottle):
                evadibles.append(ruta)

        self.assertEqual(
            evadibles,
            [],
            'DEFAULT_THROTTLE_CLASSES no debe incluir AnonRateThrottle: '
            + '; '.join(evadibles),
        )

    def test_los_throttles_publicos_clavan_por_ip(self):
        """Ninguna clase pública puede devolver `None` como clave.

        Este es el mecanismo del fallo, comprobado directamente sobre la clase
        base: si `get_cache_key` devolviera `None` para una petición autenticada,
        `SimpleRateThrottle.allow_request` la dejaría pasar sin contar nada,
        por muchas cuotas que tenga la vista.
        """
        usuario = Usuario.objects.create_user(
            username='con-sesion',
            email='con-sesion@example.com',
            password='AtacantePass123!',
        )

        class PeticionFalsa:
            # `user` autenticado es exactamente el caso que dispara el bypass.
            META = {'REMOTE_ADDR': '203.0.113.9', 'HTTP_X_REAL_IP': ''}
            COOCKIES = {}

        peticion = PeticionFalsa()
        peticion.user = usuario

        throttle = PublicIPThrottle()
        clave = throttle.get_cache_key(peticion, None)

        self.assertIsNotNone(
            clave,
            'PublicIPThrottle devolvió None para una petición autenticada: '
            'allow_request la dejaría pasar sin contar',
        )

        # Y la clave tiene que ser estable y derivarse de la IP, no del usuario:
        # si dependiera del usuario, cada cuenta nueva tendría su propio cubeta.
        otra = PeticionFalsa()
        otra.user = usuario
        self.assertEqual(clave, throttle.get_cache_key(otra, None))
