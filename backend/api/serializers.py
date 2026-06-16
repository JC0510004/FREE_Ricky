import logging
from rest_framework import serializers
from .models import Usuario, Nivel, Partida
from .utils import (
    sanitize_input, validate_email, validate_username,
    normalize_email, check_password_strength
)

logger = logging.getLogger('seguridad')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    confirm_password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    class Meta:
        model = Usuario
        fields = ['username', 'email', 'password', 'confirm_password', 'rol']
        extra_kwargs = {
            'rol': {'read_only': True},
        }

    def validate_username(self, value):
        sanitized = sanitize_input(value)
        if not validate_username(sanitized):
            raise serializers.ValidationError(
                'El usuario debe tener entre 3 y 50 caracteres alfanuméricos o guión bajo'
            )
        if Usuario.objects.filter(username__iexact=sanitized).exists():
            raise serializers.ValidationError('Este nombre de usuario ya está registrado')
        return sanitized

    def validate_email(self, value):
        sanitized = sanitize_input(value)
        if not validate_email(sanitized):
            raise serializers.ValidationError('Debe ser un correo @gmail.com o @hotmail.com')
        normalized = normalize_email(sanitized)
        if Usuario.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError('Este correo electrónico ya está registrado')
        return normalized

    def validate_password(self, value):
        errors = check_password_strength(value)
        if errors:
            raise serializers.ValidationError(errors)
        return value

    def validate(self, data):
        if data['password'] != data.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Las contraseñas no coinciden'})
        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        usuario = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.save()
        logger.info(f"Usuario registrado: {usuario.username}", extra={
            'user_id': usuario.id,
            'username': usuario.username,
        })
        return usuario


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50)
    password = serializers.CharField(max_length=128)

    def validate_username(self, value):
        return sanitize_input(value)


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        sanitized = sanitize_input(value)
        if not validate_email(sanitized):
            raise serializers.ValidationError('Debe ser un correo @gmail.com o @hotmail.com')
        return normalize_email(sanitized)


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    confirm_password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    def validate_password(self, value):
        errors = check_password_strength(value)
        if errors:
            raise serializers.ValidationError(errors)
        return value

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Las contraseñas no coinciden'})
        return data


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'rol', 'fecha_registro', 'is_active', 'is_verified', 'last_login']
        read_only_fields = ['id', 'fecha_registro', 'is_active', 'is_verified', 'last_login']


class NivelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Nivel
        fields = '__all__'
        read_only_fields = ['id', 'fecha_creacion']


class PartidaSerializer(serializers.ModelSerializer):
    usuario_username = serializers.CharField(source='usuario.username', read_only=True)
    nivel_nombre = serializers.CharField(source='nivel.nombre', read_only=True)
    nivel_dificultad = serializers.CharField(source='nivel.dificultad', read_only=True)

    class Meta:
        model = Partida
        fields = ['id', 'usuario', 'usuario_username', 'nivel', 'nivel_nombre',
                   'nivel_dificultad', 'muertes', 'tiempo', 'puntuacion', 'fecha']
        read_only_fields = ['id', 'usuario', 'usuario_username', 'nivel_nombre',
                             'nivel_dificultad', 'fecha']


class PartidaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Partida
        fields = ['nivel', 'muertes', 'tiempo', 'puntuacion']


class UserStatsSerializer(serializers.Serializer):
    total_partidas = serializers.IntegerField()
    mejor_puntuacion = serializers.IntegerField()
    peor_puntuacion = serializers.IntegerField()
    promedio_puntuacion = serializers.FloatField()
    total_muertes = serializers.IntegerField()
    promedio_muertes = serializers.FloatField()
    tiempo_total = serializers.IntegerField()
    nivel_favorito = serializers.CharField(allow_null=True)
    partidas_por_dificultad = serializers.DictField(child=serializers.IntegerField())
