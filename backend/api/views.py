from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Usuario
from .serializers import UsuarioSerializer

# Registro y listar usuarios
class UsuarioListCreateView(APIView):

    def get(self, request):
        usuarios = Usuario.objects.all()
        serializer = UsuarioSerializer(usuarios, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = UsuarioSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Editar y eliminar usuario
class UsuarioDetailView(APIView):

    def get_object(self, pk):
        try:
            return Usuario.objects.get(pk=pk)
        except Usuario.DoesNotExist:
            return None

    def get(self, request, pk):
        usuario = self.get_object(pk)
        if not usuario:
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = UsuarioSerializer(usuario)
        return Response(serializer.data)

    def put(self, request, pk):
        usuario = self.get_object(pk)
        if not usuario:
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = UsuarioSerializer(usuario, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        usuario = self.get_object(pk)
        if not usuario:
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        usuario.delete()
        return Response({'mensaje': 'Usuario eliminado'}, status=status.HTTP_204_NO_CONTENT)

# Login sencillo
class LoginView(APIView):

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        try:
            usuario = Usuario.objects.get(email=email, password=password)
            serializer = UsuarioSerializer(usuario)
            return Response({'mensaje': 'Login exitoso', 'usuario': serializer.data})
        except Usuario.DoesNotExist:
            return Response({'error': 'Credenciales incorrectas'}, status=status.HTTP_401_UNAUTHORIZED)