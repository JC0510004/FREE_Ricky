from django.core.cache import cache
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase

from .middleware import BruteForceIPMiddleware


class BruteForceMiddlewareIntegrationTests(SimpleTestCase):
    """Prueba BruteForceIPMiddleware como middleware real.

    Cubre el camino petición -> respuesta. En settings.py este middleware
    no se carga durante los tests, así que aquí se instancia a mano con
    una vista falsa que responde el status que queramos.
    """

    IP_ATACANTE = '9.9.9.9'
    IP_NORMAL = '8.8.8.8'
    RUTA = '/api/login/'

    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()

    # ── Helpers ──────────────────────────────────────────────────────

    def _middleware(self, status_code):
        """Middleware cuya 'vista' siempre responde con status_code."""
        def vista(request):
            return HttpResponse(status=status_code)
        return BruteForceIPMiddleware(vista)

    def _peticion(self, ip):
        return self.factory.post(self.RUTA, REMOTE_ADDR=ip)

    def _provocar_bloqueo(self, ip):
        """Simula MAX_ATTEMPTS respuestas 401 seguidas desde la misma IP."""
        falla = self._middleware(401)
        for _ in range(BruteForceIPMiddleware.MAX_ATTEMPTS):
            falla(self._peticion(ip))

    # ── Tests ────────────────────────────────────────────────────────

    def test_ip_se_bloquea_tras_fallos_repetidos(self):
        self._provocar_bloqueo(self.IP_ATACANTE)

        # La vista respondería 200, pero la IP bloqueada recibe 429
        respuesta = self._middleware(200)(self._peticion(self.IP_ATACANTE))

        self.assertEqual(respuesta.status_code, 429)

    def test_otra_ip_no_se_ve_afectada(self):
        self._provocar_bloqueo(self.IP_ATACANTE)

        respuesta = self._middleware(200)(self._peticion(self.IP_NORMAL))

        self.assertEqual(respuesta.status_code, 200)
        
