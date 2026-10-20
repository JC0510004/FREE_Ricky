from django.db.models import Avg, Count, Sum, Max, Value
from django.db.models.functions import Coalesce

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers, status
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from drf_spectacular.utils import extend_schema, inline_serializer, OpenApiParameter

from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Usuario, Partida, Nivel
from .permissions import IsAdminRole


class AdminPartidasView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = PageNumberPagination
    page_size = 50

    @extend_schema(
        tags=['Administración'],
        summary='Partidas (admin)',
        description='Devuelve un resumen agregado por usuario (una fila por usuario): '
                    'suma de puntos de todos sus intentos, mejor puntuación, muertes totales '
                    'y tiempo total, ordenado de menor a mayor por puntos acumulados. '
                    'Admite los query params opcionales `nivel` (id del nivel) y '
                    '`nombre` (búsqueda parcial por username) para filtrar. '
                    'Solo administradores.',
        parameters=[
            OpenApiParameter(name='nivel', type=int, required=False,
                             description='Filtra las partidas de un nivel concreto.'),
            OpenApiParameter(name='nombre', type=str, required=False,
                             description='Búsqueda parcial por username (insensible a mayúsculas).'),
        ],
        responses={200: inline_serializer(
            'PartidaResumen',
            {
                'usuario_username': serializers.CharField(),
                'puntos_totales': serializers.IntegerField(),
                'mejor_puntuacion': serializers.IntegerField(),
                'muertes_totales': serializers.IntegerField(),
                'tiempo_total': serializers.IntegerField(allow_null=True),
                'num_partidas': serializers.IntegerField(),
            },
            many=True,
        )},
    )
    def get(self, request):
        # .values() hace el JOIN con usuario automáticamente: no hace falta
        # select_related aquí (la respuesta solo lleva username, no objetos).
        partidas = Partida.objects.all()

        # Filtro opcional por nivel (query param ?nivel=<id>).
        nivel_param = request.query_params.get('nivel')
        if nivel_param is not None:
            try:
                partidas = partidas.filter(nivel_id=int(nivel_param))
            except (TypeError, ValueError):
                return Response({'error': 'nivel inválido'}, status=status.HTTP_400_BAD_REQUEST)

        # Búsqueda parcial por username (?nombre=texto, insensible a mayúsculas).
        nombre_param = request.query_params.get('nombre')
        if nombre_param:
            partidas = partidas.filter(usuario__username__icontains=nombre_param)

        # Una sola fila por usuario con sus agregados.
        resumen = (
            partidas
            .values('usuario_id', 'usuario__username')
            .annotate(
                puntos_totales=Coalesce(Sum('puntuacion'), Value(0)),
                mejor_puntuacion=Coalesce(Max('puntuacion'), Value(0)),
                muertes_totales=Coalesce(Sum('muertes'), Value(0)),
                tiempo_total=Sum('tiempo'),
                num_partidas=Count('id'),
            )
            .order_by('puntos_totales', 'usuario__username')
        )

        paginator = self.pagination_class()
        paginator.page_size = self.page_size
        page_obj = paginator.paginate_queryset(resumen, request)
        filas = [{
            'usuario_username': r['usuario__username'],
            'puntos_totales': r['puntos_totales'],
            'mejor_puntuacion': r['mejor_puntuacion'],
            'muertes_totales': r['muertes_totales'],
            'tiempo_total': r['tiempo_total'],
            'num_partidas': r['num_partidas'],
        } for r in page_obj]
        return paginator.get_paginated_response(filas)


class AdminStatsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]

    @extend_schema(
        tags=['Administración'],
        summary='Estadísticas globales',
        description='Devuelve estadísticas globales de la plataforma: totals de usuarios, '
        'partidas, niveles, puntuaciones y el jugador más activo.',
        responses={200: inline_serializer(
            'AdminStatsResponse',
            {
                'total_usuarios': serializers.IntegerField(),
                'total_partidas': serializers.IntegerField(),
                'total_niveles': serializers.IntegerField(),
                'mejor_puntuacion_global': serializers.IntegerField(),
                'promedio_puntuacion_global': serializers.FloatField(),
                'total_muertes_global': serializers.IntegerField(),
                'jugador_mas_activo': serializers.CharField(allow_null=True),
            },
        )},
    )
    def get(self, request):
        total_usuarios = Usuario.objects.count()
        total_partidas = Partida.objects.count()
        total_niveles = Nivel.objects.count()

        stats_partidas = Partida.objects.aggregate(
            mejor_puntuacion=Max('puntuacion'),
            promedio_puntuacion=Avg('puntuacion'),
            total_muertes=Sum('muertes'),
        )

        top_jugador = (
            Partida.objects.values('usuario__username')
            .annotate(total=Count('id'))
            .order_by('-total')
            .first()
        )

        return Response({
            'total_usuarios': total_usuarios,
            'total_partidas': total_partidas,
            'total_niveles': total_niveles,
            'mejor_puntuacion_global': stats_partidas['mejor_puntuacion'] or 0,
            'promedio_puntuacion_global': round(stats_partidas['promedio_puntuacion'] or 0, 1),
            'total_muertes_global': stats_partidas['total_muertes'] or 0,
            'jugador_mas_activo': top_jugador['usuario__username'] if top_jugador else None,
        })
