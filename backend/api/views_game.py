import logging

from django.db.models import Q, Avg, Count, Sum, Max, Min

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Nivel, Partida
from .serializers import (
    NivelSerializer, PartidaSerializer, PartidaCreateSerializer,
    UserStatsSerializer,
)
from .permissions import IsAdminRole

logger = logging.getLogger('seguridad')
audit_logger = logging.getLogger('auditoria')


class NivelListView(APIView):
    pagination_class = PageNumberPagination
    page_size = 50

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_authentication_classes(self):
        if self.request.method == 'GET':
            return []
        return [JWTAuthentication()]

    def get(self, request):
        niveles = Nivel.objects.all().order_by('dificultad', 'nombre')
        paginator = self.pagination_class()
        paginator.page_size = self.page_size
        page_obj = paginator.paginate_queryset(niveles, request)
        serializer = NivelSerializer(page_obj, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        if getattr(request.user, 'rol', None) != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        serializer = NivelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NivelDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_object(self, pk):
        try:
            return Nivel.objects.get(pk=pk)
        except Nivel.DoesNotExist:
            return None

    def put(self, request, pk):
        nivel = self.get_object(pk)
        if not nivel:
            return Response({'error': 'No encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = NivelSerializer(nivel, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        nivel = self.get_object(pk)
        if not nivel:
            return Response({'error': 'No encontrado'}, status=status.HTTP_404_NOT_FOUND)
        nivel.delete()
        return Response({'mensaje': 'Nivel eliminado'})


class PartidaListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    page_size = 20

    def get(self, request):
        partidas = Partida.objects.select_related('nivel', 'usuario').filter(usuario=request.user).order_by('-fecha')
        paginator = self.pagination_class()
        paginator.page_size = self.page_size
        page_obj = paginator.paginate_queryset(partidas, request)
        serializer = PartidaSerializer(page_obj, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = PartidaCreateSerializer(data=request.data)
        if serializer.is_valid():
            partida = serializer.save(usuario=request.user)
            data = PartidaSerializer(partida).data
            return Response(data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PartidaDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Partida.objects.get(pk=pk)
        except Partida.DoesNotExist:
            return None

    def get(self, request, pk):
        partida = self.get_object(pk)
        if not partida:
            return Response({'error': 'No encontrada'}, status=status.HTTP_404_NOT_FOUND)
        if partida.usuario_id != request.user.id and request.user.rol != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PartidaSerializer(partida)
        return Response(serializer.data)


class RankingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        ranking = (
            Partida.objects.values('usuario', 'usuario__username')
            .annotate(
                mejor_puntuacion=Max('puntuacion'),
                total_partidas=Count('id'),
                promedio_puntuacion=Avg('puntuacion'),
            )
            .filter(mejor_puntuacion__isnull=False)
            .order_by('-mejor_puntuacion')[:20]
        )
        data = [
            {
                'posicion': i + 1,
                'usuario_id': r['usuario'],
                'username': r['usuario__username'],
                'mejor_puntuacion': r['mejor_puntuacion'],
                'total_partidas': r['total_partidas'],
                'promedio_puntuacion': round(r['promedio_puntuacion'], 1) if r['promedio_puntuacion'] else None,
            }
            for i, r in enumerate(ranking)
        ]
        return Response(data)


class UserStatsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        partidas = Partida.objects.filter(usuario=request.user)
        total = partidas.count()

        if total == 0:
            return Response(UserStatsSerializer({
                'total_partidas': 0,
                'mejor_puntuacion': 0,
                'peor_puntuacion': 0,
                'promedio_puntuacion': 0,
                'total_muertes': 0,
                'promedio_muertes': 0,
                'tiempo_total': 0,
                'nivel_favorito': None,
                'partidas_por_dificultad': {'facil': 0, 'medio': 0, 'dificil': 0},
            }).data)

        stats = partidas.aggregate(
            mejor_puntuacion=Max('puntuacion'),
            peor_puntuacion=Min('puntuacion'),
            promedio_puntuacion=Avg('puntuacion'),
            total_muertes=Sum('muertes'),
            promedio_muertes=Avg('muertes'),
            tiempo_total=Sum('tiempo'),
        )

        nivel_favorito = (
            partidas.values('nivel__nombre')
            .annotate(total=Count('id'))
            .order_by('-total')
            .first()
        )

        por_dificultad = (
            partidas.values('nivel__dificultad')
            .annotate(total=Count('id'))
        )
        dificultad_map = {'facil': 0, 'medio': 0, 'dificil': 0}
        for d in por_dificultad:
            key = d['nivel__dificultad']
            if key in dificultad_map:
                dificultad_map[key] = d['total']

        serializer = UserStatsSerializer({
            'total_partidas': total,
            'mejor_puntuacion': stats['mejor_puntuacion'] or 0,
            'peor_puntuacion': stats['peor_puntuacion'] or 0,
            'promedio_puntuacion': round(stats['promedio_puntuacion'] or 0, 1),
            'total_muertes': stats['total_muertes'] or 0,
            'promedio_muertes': round(stats['promedio_muertes'] or 0, 1),
            'tiempo_total': stats['tiempo_total'] or 0,
            'nivel_favorito': nivel_favorito['nivel__nombre'] if nivel_favorito else None,
            'partidas_por_dificultad': dificultad_map,
        })
        return Response(serializer.data)
