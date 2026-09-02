from django.db.models import Avg, Count, Sum, Max

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Usuario, Partida, Nivel
from .serializers import PartidaSerializer
from .permissions import IsAdminRole


class AdminPartidasView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = PageNumberPagination
    page_size = 50

    def get(self, request):
        partidas = Partida.objects.select_related('usuario', 'nivel').order_by('-fecha')
        paginator = self.pagination_class()
        paginator.page_size = self.page_size
        page_obj = paginator.paginate_queryset(partidas, request)
        serializer = PartidaSerializer(page_obj, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminStatsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]

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
