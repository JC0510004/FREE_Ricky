"""Pruebas de integracion de permisos: usuarios y niveles.

Fijan quien puede hacer que: un jugador no se asciende a admin, no toca a
otros usuarios ni a los niveles, y solo un admin lista, edita y desactiva.
Usan la base de datos de pruebas (TestCase).
"""
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Nivel, Usuario

CLAVE = 'Clave123!'


def crear_usuario(username, rol='jugador'):
    usuario = Usuario(username=username, email=f'{username}@correo.com', rol=rol)
    usuario.set_password(CLAVE)
    usuario.is_verified = True
    usuario.save()
    return usuario


def cliente_de(usuario=None):
    cliente = APIClient()
    if usuario is not None:
        cliente.force_authenticate(user=usuario)
    return cliente


class PermisosUsuariosTests(TestCase):
    def setUp(self):
        self.admin = crear_usuario('admin_uno', rol='admin')
        self.jugador = crear_usuario('jugador_uno')
        self.otro = crear_usuario('jugador_dos')

    def url(self, usuario):
        return f'/api/usuarios/{usuario.id}/'

    # ─── Listado ──────────────────────────────────────────────────────
    def test_anonimo_no_puede_listar_usuarios(self):
        respuesta = cliente_de().get('/api/usuarios/')
        self.assertEqual(respuesta.status_code, 401)

    def test_jugador_no_puede_listar_usuarios(self):
        respuesta = cliente_de(self.jugador).get('/api/usuarios/')
        self.assertEqual(respuesta.status_code, 403)

    def test_admin_puede_listar_usuarios(self):
        respuesta = cliente_de(self.admin).get('/api/usuarios/')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 3)

    # ─── Detalle ──────────────────────────────────────────────────────
    def test_jugador_ve_su_propio_perfil(self):
        respuesta = cliente_de(self.jugador).get(self.url(self.jugador))
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['username'], 'jugador_uno')

    def test_jugador_no_ve_el_perfil_de_otro(self):
        respuesta = cliente_de(self.jugador).get(self.url(self.otro))
        self.assertEqual(respuesta.status_code, 403)

    def test_admin_ve_cualquier_perfil(self):
        respuesta = cliente_de(self.admin).get(self.url(self.jugador))
        self.assertEqual(respuesta.status_code, 200)

    # ─── Edicion y escalada de rol ────────────────────────────────────
    def test_jugador_no_puede_ascenderse_a_admin(self):
        respuesta = cliente_de(self.jugador).put(
            self.url(self.jugador), {'rol': 'admin'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('rol', respuesta.data)
        self.jugador.refresh_from_db()
        self.assertEqual(self.jugador.rol, 'jugador')

    def test_jugador_puede_cambiar_su_propio_nombre(self):
        respuesta = cliente_de(self.jugador).put(
            self.url(self.jugador), {'username': 'nombre_nuevo'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 200)
        self.jugador.refresh_from_db()
        self.assertEqual(self.jugador.username, 'nombre_nuevo')

    def test_jugador_puede_enviar_su_mismo_rol(self):
        # El panel manda siempre el rol actual; no debe contar como cambio.
        respuesta = cliente_de(self.jugador).put(
            self.url(self.jugador), {'rol': 'jugador'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 200)

    def test_jugador_no_puede_editar_a_otro(self):
        respuesta = cliente_de(self.jugador).put(
            self.url(self.otro), {'username': 'hackeado'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 403)
        self.otro.refresh_from_db()
        self.assertEqual(self.otro.username, 'jugador_dos')

    def test_admin_puede_cambiar_el_rol_de_otro(self):
        respuesta = cliente_de(self.admin).put(
            self.url(self.jugador), {'rol': 'admin'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 200)
        self.jugador.refresh_from_db()
        self.assertEqual(self.jugador.rol, 'admin')

    def test_rol_invalido_se_rechaza(self):
        respuesta = cliente_de(self.admin).put(
            self.url(self.jugador), {'rol': 'superadmin'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 400)

    def test_no_se_puede_activar_ni_verificar_por_la_api(self):
        self.jugador.is_verified = False
        self.jugador.save()
        respuesta = cliente_de(self.jugador).put(
            self.url(self.jugador), {'is_verified': True, 'is_active': False}, format='json'
        )
        self.assertEqual(respuesta.status_code, 200)
        self.jugador.refresh_from_db()
        self.assertFalse(self.jugador.is_verified)
        self.assertTrue(self.jugador.is_active)

    # ─── Desactivar ───────────────────────────────────────────────────
    def test_jugador_no_puede_desactivar_a_nadie(self):
        respuesta = cliente_de(self.jugador).delete(self.url(self.otro))
        self.assertEqual(respuesta.status_code, 403)
        self.otro.refresh_from_db()
        self.assertTrue(self.otro.is_active)

    def test_admin_no_puede_desactivarse_a_si_mismo(self):
        respuesta = cliente_de(self.admin).delete(self.url(self.admin))
        self.assertEqual(respuesta.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_admin_desactiva_a_otro_y_queda_marcado(self):
        respuesta = cliente_de(self.admin).delete(self.url(self.otro))
        self.assertEqual(respuesta.status_code, 200)
        self.otro.refresh_from_db()
        self.assertFalse(self.otro.is_active)
        self.assertTrue(self.otro.desactivado_por_admin)

    def test_usuario_desactivado_ya_no_aparece_en_el_listado(self):
        cliente_de(self.admin).delete(self.url(self.otro))
        respuesta = cliente_de(self.admin).get('/api/usuarios/')
        nombres = [u['username'] for u in respuesta.data['results']]
        self.assertNotIn('jugador_dos', nombres)


class PermisosNivelesTests(TestCase):
    def setUp(self):
        self.admin = crear_usuario('admin_uno', rol='admin')
        self.jugador = crear_usuario('jugador_uno')
        self.nivel = Nivel.objects.create(nombre='Isla', dificultad='facil')

    def test_cualquiera_puede_ver_los_niveles(self):
        respuesta = cliente_de().get('/api/niveles/')
        self.assertEqual(respuesta.status_code, 200)

    def test_niveles_son_publicos_aunque_llegue_un_token_invalido(self):
        # Un token vencido o corrupto no debe romper una lista publica.
        # Si falla con 401, la clase de autenticacion de NivelListView no se
        # esta aplicando (DRF no llama a get_authentication_classes).
        cliente = APIClient()
        cliente.credentials(HTTP_AUTHORIZATION='Bearer token.invalido.basura')
        respuesta = cliente.get('/api/niveles/')
        self.assertEqual(respuesta.status_code, 200)

    def test_anonimo_no_puede_crear_niveles(self):
        respuesta = cliente_de().post(
            '/api/niveles/', {'nombre': 'Cueva', 'dificultad': 'medio'}, format='json'
        )
        self.assertIn(respuesta.status_code, (401, 403))
        self.assertEqual(Nivel.objects.count(), 1)

    def test_jugador_no_puede_crear_niveles(self):
        respuesta = cliente_de(self.jugador).post(
            '/api/niveles/', {'nombre': 'Cueva', 'dificultad': 'medio'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(Nivel.objects.count(), 1)

    def test_admin_puede_crear_niveles(self):
        respuesta = cliente_de(self.admin).post(
            '/api/niveles/', {'nombre': 'Cueva', 'dificultad': 'medio'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(Nivel.objects.count(), 2)

    def test_jugador_no_puede_editar_ni_borrar_niveles(self):
        cliente = cliente_de(self.jugador)
        url = f'/api/niveles/{self.nivel.id}/'
        self.assertEqual(cliente.put(url, {'nombre': 'X'}, format='json').status_code, 403)
        self.assertEqual(cliente.delete(url).status_code, 403)
        self.assertTrue(Nivel.objects.filter(pk=self.nivel.pk).exists())

    def test_admin_puede_editar_y_borrar_niveles(self):
        cliente = cliente_de(self.admin)
        url = f'/api/niveles/{self.nivel.id}/'
        self.assertEqual(cliente.put(url, {'nombre': 'Isla 2'}, format='json').status_code, 200)
        self.nivel.refresh_from_db()
        self.assertEqual(self.nivel.nombre, 'Isla 2')
        self.assertEqual(cliente.delete(url).status_code, 200)
        self.assertFalse(Nivel.objects.filter(pk=self.nivel.pk).exists())
