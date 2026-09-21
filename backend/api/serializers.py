# ─── IMPORTACIONES ───────────────────────────────────────────────────────────
# Serializadores de Django REST Framework para convertir datos entre JSON y modelos
from rest_framework import serializers

# Modelos de dominio: usuarios, niveles del juego y partidas
from .models import Usuario, Nivel, Partida

# Funciones utilitarias de seguridad: sanitización, validación de email/usuario,
# normalización de correo y verificación de fortaleza de contraseña
from .utils import (
    sanitize_input, validate_email, validate_username,
    normalize_email, check_password_strength
)


# ═══════════════════════════════════════════════════════════════════════════════
# SERIALIZER DE REGISTRO
# ═══════════════════════════════════════════════════════════════════════════════
# Se encarga de validar y crear nuevos usuarios durante el proceso de registro.
# Incluye campos auxiliares write_only (contraseña y confirmación) que nunca se
# exponen en las respuestas, protegiendo así datos sensibles.
class RegisterSerializer(serializers.ModelSerializer):
    # Campo de contraseña: solo escritura (nunca se devuelve en respuestas),
    # con restricciones de longitud mínima y máxima por seguridad
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    # Campo de confirmación de contraseña: obliga al usuario a escribir la
    # contraseña dos veces para evitar errores de tipeo
    confirm_password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    # ─── METADATA DEL SERIALIZER ───────────────────────────────────────────
    # Define el modelo subyacente, los campos expuestos y campos de solo lectura
    class Meta:
        model = Usuario
        # Campos incluidos en la serialización de entrada/salida
        fields = ['username', 'email', 'password', 'confirm_password', 'rol']
        extra_kwargs = {
            # El rol es de solo lectura porque se asigna del lado del servidor
            # (por defecto 'jugador'); nunca debe ser proporcionado por el cliente
            'rol': {'read_only': True},
            # Quitamos el UniqueValidator automático (que rechazaría cuentas
            # DESACTIVADAS): la unicidad la validan validate_username/email,
            # que solo consideran cuentas activas, y create() reactiva la cuenta.
            'username': {'validators': []},
            'email': {'validators': []},
        }

    # ─── VALIDACIÓN INDIVIDUAL DE CAMPOS ──────────────────────────────────

    # Valida y sanitiza el nombre de usuario antes de guardarlo.
    # Primero elimina caracteres peligrosos (XSS, inyección) y luego
    # verifica que cumpla con las reglas de formato y unicidad.
    # Un username que solo pertenezca a una cuenta DESACTIVADA (eliminada
    # por el admin) sí puede volver a usarse: create() reactiva esa cuenta.
    def validate_username(self, value):
        # Sanitiza la entrada eliminando etiquetas HTML y caracteres de control
        sanitized = sanitize_input(value)
        # Verifica que el nombre cumpla con largo y caracteres permitidos
        if not validate_username(sanitized):
            raise serializers.ValidationError(
                'El usuario debe tener entre 3 y 50 caracteres, y solo letras, números, guiones o guión bajo'
            )
        # Busca si ya existe un usuario ACTIVO con el mismo nombre (case-insensitive)
        if Usuario.objects.filter(username__iexact=sanitized, is_active=True).exists():
            raise serializers.ValidationError('Este nombre de usuario no está disponible')
        return sanitized

    # Valida y sanitiza el correo electrónico; además lo normaliza
    # para evitar duplicados por variantes del mismo correo (ej:+tags).
    # Igual que el username: un correo de una cuenta desactivada puede
    # volver a usarse (la cuenta se reactiva al registrarse).
    def validate_email(self, value):
        # Limpia la entrada de posibles ataques
        sanitized = sanitize_input(value)
        # Verifica formato válido de email mediante expresión regular
        if not validate_email(sanitized):
            raise serializers.ValidationError('Debe ser un correo electrónico válido')
        # Normaliza el email (minúsculas, remueve alias +) para unicidad real
        normalized = normalize_email(sanitized)
        # Comprueba que no lo tenga registrado una cuenta ACTIVA (case-insensitive)
        if Usuario.objects.filter(email__iexact=normalized, is_active=True).exists():
            raise serializers.ValidationError('Este correo electrónico no está disponible')
        return normalized

    # Valida la fortaleza de la contraseña usando reglas de seguridad:
    # mayúsculas, minúsculas, números, caracteres especiales y longitud
    def validate_password(self, value):
        # check_password_strength retorna una lista de errores; si no está vacía,
        # significa que la contraseña no cumple con los requisitos mínimos
        errors = check_password_strength(value)
        if errors:
            raise serializers.ValidationError(errors)
        return value

    # ─── VALIDACIÓN CRUZADA DE CAMPOS ─────────────────────────────────────
    # Verifica que las contraseñas coincidan. Se ejecuta después de las
    # validaciones individuales de cada campo.
    def validate(self, data):
        # Se extrae 'confirm_password' porque no pertenece al modelo;
        # solo se usa para la validación de coincidencia
        if data['password'] != data.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Las contraseñas no coinciden'})
        return data

    # ─── CREACIÓN DEL USUARIO ─────────────────────────────────────────────
    # Crea la instancia del usuario en la base de datos, hasheando la
    # contraseña con el algoritmo configurado (argon2) antes de persistir.
    #
    # Si el username/email pertenece a una cuenta DESACTIVADA (el admin la
    # "eliminó" con soft-delete y username/email son únicos en BD), no se
    # crea una fila nueva: se REACTIVA esa misma cuenta con los datos y la
    # contraseña del formulario, conservando su historial de partidas.
    def create(self, validated_data):
        # Se extrae la contraseña del diccionario porque set_password
        # la hashea internamente; no se almacena en texto plano
        password = validated_data.pop('password')
        username = validated_data['username']
        email = validated_data['email']

        # Cuenta desactivada que reclamará estos datos (prioriza el username).
        candidata = (
            Usuario.objects.filter(username__iexact=username, is_active=False).first()
            or Usuario.objects.filter(email__iexact=email, is_active=False).first()
        )

        if candidata is None:
            # Alta normal: no existe ninguna cuenta desactivada con estos datos.
            usuario = Usuario(**validated_data)
            usuario.set_password(password)
            usuario.save()
            return usuario

        # Al reactivar la candidata adoptará el username y email del formulario.
        # Si algún OTRO usuario (activo o inactivo) ya los ocupa, no podemos
        # reactivar sin violar las restricciones únicas de la BD.
        username_taken = (
            Usuario.objects.filter(username__iexact=username)
            .exclude(pk=candidata.pk)
            .exists()
        )
        email_taken = (
            Usuario.objects.filter(email__iexact=email)
            .exclude(pk=candidata.pk)
            .exists()
        )
        if username_taken or email_taken:
            raise serializers.ValidationError({
                'username': ['Este nombre de usuario no está disponible'],
                'email': ['Este correo electrónico no está disponible'],
            })

        candidata.username = username
        candidata.email = email
        # La cuenta PERMANECE desactivada hasta que el propietario confirme el
        # email desde el enlace que se acaba de enviar: nadie puede reclamar y
        # operar una cuenta desactivada sin control del correo. La activación
        # la hace VerificarEmailView (que además marca is_verified=True).
        candidata.is_active = False
        candidata.is_verified = False
        candidata.failed_attempts = 0
        candidata.locked_until = None
        candidata.lockout_count = 0
        candidata.set_password(password)
        candidata.save()
        # Bandera para que la vista pueda auditar la reactivación.
        candidata._reactivado = True
        return candidata


# ═══════════════════════════════════════════════════════════════════════════════
# SERIALIZER DE INICIO DE SESIÓN
# ═══════════════════════════════════════════════════════════════════════════════
# Acepta credenciales de login (usuario y contraseña).
# No valida existencia aquí; esa lógica vive en la vista/viewset correspondiente
# para no revelar si el usuario existe (prevención de enumeración).
class LoginSerializer(serializers.Serializer):
    # Nombre de usuario o correo electrónico para identificar la cuenta
    username = serializers.CharField(max_length=50)
    # Contraseña en texto plano (solo se usa para comparación; nunca se almacena)
    password = serializers.CharField(max_length=128)

    # Sanitiza el campo de usuario/email para prevenir inyección
    # de caracteres especiales en la consulta de búsqueda
    def validate_username(self, value):
        return sanitize_input(value)


# ═══════════════════════════════════════════════════════════════════════════════
# SERIALIZER DE SOLICITUD DE RESTABLECIMIENTO DE CONTRASEÑA
# ═══════════════════════════════════════════════════════════════════════════════
# Recibe el correo electrónico del usuario que desea restablecer su contraseña.
# El token de recuperación se genera internamente y se envía por correo.
class PasswordResetSerializer(serializers.Serializer):
    # Campo de correo electrónico para identificar la cuenta a restablecer
    email = serializers.EmailField()

    # Valida y normaliza el email antes de buscar la cuenta
    def validate_email(self, value):
        # Sanitiza la entrada contra XSS e inyección
        sanitized = sanitize_input(value)
        if not validate_email(sanitized):
            raise serializers.ValidationError('Debe ser un correo electrónico válido')
        # Normaliza para coincidir con el formato almacenado
        return normalize_email(sanitized)


# ═══════════════════════════════════════════════════════════════════════════════
# SERIALIZER DE CONFIRMACIÓN DE RESTABLECIMIENTO
# ═══════════════════════════════════════════════════════════════════════════════
# Se usa cuando el usuario hace clic en el enlace del correo y establece
# una nueva contraseña. El token y el código se validan en la vista, no aquí.
class PasswordResetConfirmSerializer(serializers.Serializer):
    # Token único generado en el paso anterior (validado en la vista)
    token = serializers.CharField()
    # Código numérico de 6 dígitos recibido por email (segundo factor).
    # Se exige además del clic en el enlace para fijar la nueva contraseña.
    codigo = serializers.RegexField(r'^\d{6}$', error_messages={'invalid': 'El código debe ser de 6 dígitos'})
    # Nueva contraseña con restricciones de longitud
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    # Confirmación de la nueva contraseña para evitar errores de tipeo
    confirm_password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    # Aplica las mismas reglas de fortaleza que en el registro
    def validate_password(self, value):
        errors = check_password_strength(value)
        if errors:
            raise serializers.ValidationError(errors)
        return value

    # Verifica que ambas contraseñas coincidan antes de procesar el cambio
    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Las contraseñas no coinciden'})
        return data


# ═══════════════════════════════════════════════════════════════════════════════
# SERIALIZER DE LECTURA DE USUARIO (PERFIL)
# ═══════════════════════════════════════════════════════════════════════════════
# Serializer de solo lectura para exponer información del perfil de usuario.
# No permite crear ni modificar usuarios; solo mostra datos existentes.
class UsuarioSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(max_length=100)

    class Meta:
        model = Usuario
        # Campos visibles en el perfil: identificador, nombre, email, rol,
        # fecha de registro, estado activo, verificación y último acceso
        fields = ['id', 'username', 'email', 'rol', 'fecha_registro', 'is_active', 'is_verified', 'last_login']
        # Solo campos de solo lectura: id, fecha, estado y verificación.
        # username, email y rol se pueden editar; el cambio de rol solo lo
        # permite un administrador (ver validate_rol).
        read_only_fields = ['id', 'fecha_registro', 'is_active', 'is_verified', 'last_login']

    # Solo un administrador puede cambiar el rol de un usuario. Esto impide
    # que un jugador se auto-promocione a admin vía PUT /usuarios/<id>/.
    def validate_rol(self, value):
        if value not in ['admin', 'jugador']:
            raise serializers.ValidationError('El rol debe ser "admin" o "jugador"')
        if self.instance and value != self.instance.rol:
            request = self.context.get('request')
            is_admin = request and getattr(request.user, 'rol', None) == 'admin'
            if not is_admin:
                raise serializers.ValidationError('No tienes permisos para cambiar el rol')
        return value

    # Valida que el username no esté en uso por otro usuario
    def validate_username(self, value):
        sanitized = sanitize_input(value)
        if not sanitized or len(sanitized) < 3:
            raise serializers.ValidationError('El nombre de usuario debe tener al menos 3 caracteres')
        if not sanitized.isalnum() and not all(c.isalnum() or c in '_-' for c in sanitized):
            raise serializers.ValidationError('El nombre de usuario solo puede contener letras, números, guiones y guiones bajos')
        # Excluye al propio usuario que se está editando (self.instance),
        # no al request.user (que podría ser un admin editando a otro).
        exclude_id = self.instance.id if self.instance else None
        if exclude_id:
            if Usuario.objects.filter(username__iexact=sanitized).exclude(id=exclude_id).exists():
                raise serializers.ValidationError('Este nombre de usuario no está disponible')
        else:
            if Usuario.objects.filter(username__iexact=sanitized).exists():
                raise serializers.ValidationError('Este nombre de usuario no está disponible')
        return sanitized

    # Permite actualizar el email del usuario actual; verifica que no esté
    # en uso por otro usuario (excluyendo al propio usuario que edita)
    def validate_email(self, value):
        sanitized = sanitize_input(value)
        if not validate_email(sanitized):
            raise serializers.ValidationError('Debe ser un correo electrónico válido')
        normalized = normalize_email(sanitized)
        # Excluye al propio usuario que se está editando (self.instance),
        # no al request.user (que podría ser un admin editando a otro)
        exclude_id = self.instance.id if self.instance else None
        if exclude_id:
            if Usuario.objects.filter(email__iexact=normalized).exclude(id=exclude_id).exists():
                raise serializers.ValidationError('Este correo electrónico no está disponible')
        else:
            if Usuario.objects.filter(email__iexact=normalized).exists():
                raise serializers.ValidationError('Este correo electrónico no está disponible')
        return normalized


# ═══════════════════════════════════════════════════════════════════════════════
# SERIALIZER DE NIVELES DEL JUEGO
# ═══════════════════════════════════════════════════════════════════════════════
# Expone todos los campos del modelo Nivel de forma directa.
# Los niveles son datos de solo lectura para los jugadores.
class NivelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Nivel
        # Incluye todos los campos del modelo Nivel automáticamente
        fields = ['id', 'nombre', 'dificultad', 'tiempo_limite', 'fecha_creacion']
        # Campos que no deben ser modificados vía API
        read_only_fields = ['id', 'fecha_creacion']


# ═══════════════════════════════════════════════════════════════════════════════
# SERIALIZER DE LECTURA DE PARTIDAS
# ═══════════════════════════════════════════════════════════════════════════════
# Serializer completo para mostrar información de partidas jugadas.
# Incluye campos anidados de solo lectura (nombre de usuario y datos del nivel)
# para evitar que el cliente necesite hacer consultas adicionales.
class PartidaSerializer(serializers.ModelSerializer):
    # Campo derivado: extrae el nombre de usuario del objeto relacionado
    # Sin esto, solo se mostraría el ID numérico del usuario
    usuario_username = serializers.CharField(source='usuario.username', read_only=True)
    # Campo derivado: nombre del nivel asociado a la partida
    nivel_nombre = serializers.CharField(source='nivel.nombre', read_only=True)
    # Campo derivado: dificultad del nivel para filtrado y visualización
    nivel_dificultad = serializers.CharField(source='nivel.dificultad', read_only=True)

    class Meta:
        model = Partida
        # Campos visibles: IDs, datos del usuario y nivel, estadísticas de la partida
        fields = ['id', 'usuario', 'usuario_username', 'nivel', 'nivel_nombre',
                  'nivel_dificultad', 'muertes', 'tiempo', 'puntuacion', 'fecha']
        # Solo lectura: el usuario y nivel se asignan del servidor; la fecha
        # se genera automáticamente al momento de crear la partida
        read_only_fields = ['id', 'usuario', 'usuario_username', 'nivel_nombre',
                            'nivel_dificultad', 'fecha']


# ═══════════════════════════════════════════════════════════════════════════════
# SERIALIZER DE CREACIÓN DE PARTIDAS
# ═══════════════════════════════════════════════════════════════════════════════
# Serializer de escritura para registrar nuevas partidas.
# Solo acepta los campos que el jugador puede proporcionar; el usuario
# y la fecha se asignan automáticamente en la vista.
class PartidaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Partida
        # Campos de entrada: nivel elegido y estadísticas de la partida
        fields = ['nivel', 'muertes', 'tiempo', 'puntuacion']

    # ─── VALIDACIONES DE RANGO ────────────────────────────────────────────
    # Cada campo numérico tiene validaciones de rango para evitar datos
    # atípicos o maliciosos que podrían distorsionar las estadísticas.

    # Valida que las muertes estén en un rango razonable (0-9999).
    # Un valor negativo indicaría datos corruptos o manipulados.
    def validate_muertes(self, value):
        if value < 0:
            raise serializers.ValidationError('Las muertes no pueden ser negativas')
        if value > 9999:
            raise serializers.ValidationError('Muertes fuera de rango permitido')
        return value

    # Valida que la puntuación sea no negativa y dentro de un rango máximo
    # que evite desbordamiento de tipos en estadísticas agregadas
    def validate_puntuacion(self, value):
        # Puede ser None si el jugador no completó ciertos objetivos
        if value is not None and value < 0:
            raise serializers.ValidationError('La puntuación no puede ser negativa')
        if value is not None and value > 999999:
            raise serializers.ValidationError('Puntuación fuera de rango permitido')
        return value

    # Valida que el tiempo sea no negativo y no supere 24 horas (86400 segundos).
    # Un tiempo mayor a un día completo se considera un dato inválido.
    def validate_tiempo(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('El tiempo no puede ser negativo')
        if value is not None and value > 86400:
            raise serializers.ValidationError('Tiempo fuera de rango permitido')
        return value


# ═══════════════════════════════════════════════════════════════════════════════
# SERIALIZER DE ESTADÍSTICAS DE USUARIO
# ═══════════════════════════════════════════════════════════════════════════════
# Serializer de solo lectura para exponer estadísticas agregadas del jugador.
# No está vinculado a un modelo directamente; los datos se calculan
# mediante agregaciones en la vista (annotate/aggregate de Django ORM).
class UserStatsSerializer(serializers.Serializer):
    # Cantidad total de partidas jugadas por el usuario
    total_partidas = serializers.IntegerField()
    # Puntuación más alta alcanzada en cualquier partida
    mejor_puntuacion = serializers.IntegerField()
    # Puntuación más baja registrada
    peor_puntuacion = serializers.IntegerField()
    # Promedio aritmético de todas las puntuaciones
    promedio_puntuacion = serializers.FloatField()
    # Suma total de muertes en todas las partidas
    total_muertes = serializers.IntegerField()
    # Promedio de muertes por partida
    promedio_muertes = serializers.FloatField()
    # Tiempo total acumulado en todas las partidas (en segundos)
    tiempo_total = serializers.IntegerField()
    # Nombre del nivel más jugado; puede ser None si no hay partidas
    nivel_favorito = serializers.CharField(allow_null=True)
    # Diccionario con la cantidad de partidas por cada nivel de dificultad
    # Ejemplo: {"facil": 5, "normal": 3, "dificil": 1}
    partidas_por_dificultad = serializers.DictField(child=serializers.IntegerField())
