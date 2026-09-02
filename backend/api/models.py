# ─── MODELOS DE BASE DE DATOS ───────────────────────────────────────────
# Este archivo define todos los modelos (tablas) de la aplicación usando
# el ORM de Django. Cada clase representa una tabla en la base de datos.

# Importamos los módulos necesarios de Django para crear modelos,
# hashear contraseñas y manejar el tiempo.
from django.db import models
from django.db.models import F
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone
import hashlib


# ─── GESTOR DE USUARIOS PERSONALIZADO ───────────────────────────────────
# Django necesita un manager personalizado因为我们 usamos AbstractBaseUser
# en lugar del modelo User por defecto. Este manager se encarga de crear
# usuarios y superusuarios con la lógica que necesitamos.
class UsuarioManager(BaseUserManager):
    # Crea un usuario regular con username, email y password.
    def create_user(self, username, email, password=None, **extra_fields):
        # Valida que el email no esté vacío, es obligatorio.
        if not email:
            raise ValueError('El email es obligatorio')
        # Normaliza el email (minúsculas en el dominio) para evitar duplicados.
        email = self.normalize_email(email)
        # Crea la instancia del usuario sin guardar aún en la BD.
        usuario = self.model(username=username, email=email, **extra_fields)
        # Si se proporcionó contraseña, la hashea antes de guardarla.
        if password:
            usuario.set_password(password)
        # Guarda el usuario en la base de datos usando la conexión activa.
        usuario.save(using=self._db)
        return usuario

    # Crea un superusuario (admin) usando create_user con rol='admin'.
    def create_superuser(self, username, email, password=None, **extra_fields):
        # Por defecto, el superusuario tiene rol de admin y está activo.
        extra_fields.setdefault('rol', 'admin')
        extra_fields.setdefault('is_active', True)
        return self.create_user(username, email, password, **extra_fields)


# ─── HASH FICTICIO PARA PROTECCIÓN DE TIEMPO ───────────────────────────
# Se genera un hash precomputado de una contraseña falsa. Se usa para
# ejecutar un "check_password" dummy cuando el usuario no existe,
# igualando el tiempo de respuesta y evitando que se pueda determinar
# si un usuario existe o no midiendo tiempos (ataque CWE-208).
_DUMMY_HASH = make_password('dummy_password_for_timing')


# ─── MODELO DE USUARIO PERSONALIZADO ────────────────────────────────────
# Modelo principal de usuarios. Hereda de AbstractBaseUser para tener
# control total sobre los campos y la autenticación.
class Usuario(AbstractBaseUser):
    # Define los roles disponibles: admin o jugador.
    ROL_CHOICES = [
        ('admin', 'Admin'),
        ('jugador', 'Jugador'),
    ]

    # Campo de rol con valor por defecto 'jugador'.
    rol = models.CharField(max_length=10, choices=ROL_CHOICES, default='jugador')
    # Nombre de usuario único, máximo 50 caracteres.
    username = models.CharField(max_length=50, unique=True)
    # Email único, máximo 100 caracteres.
    email = models.EmailField(max_length=100, unique=True)
    # Fecha de registro automática (se llena al crear el registro).
    fecha_registro = models.DateTimeField(auto_now_add=True)
    # Indica si la cuenta está activa (False = desactivada por admin).
    is_active = models.BooleanField(default=True)
    # Indica si el email ha sido verificado.
    is_verified = models.BooleanField(default=False)
    # Contador de intentos fallidos de login consecutivos.
    failed_attempts = models.IntegerField(default=0)
    # Número total de veces que la cuenta ha sido bloqueada (para escalar bloqueo).
    lockout_count = models.IntegerField(default=0)
    # Fecha/hasta cuándo la cuenta está bloqueada (null = no bloqueada).
    locked_until = models.DateTimeField(null=True, blank=True)

    # Asigna nuestro manager personalizado al modelo.
    objects = UsuarioManager()

    # Campo usado como identificador para login (en vez de email).
    USERNAME_FIELD = 'username'
    # Campos requeridos al crear superusuario (además de username y password).
    REQUIRED_FIELDS = ['email']

    # Configuración de la tabla en la base de datos.
    class Meta:
        db_table = 'usuarios'

    # Representación en texto del objeto (para admin de Django y depuración).
    def __str__(self):
        return self.username

    # Verifica si el usuario tiene un permiso específico. Solo admins tienen permisos.
    def has_perm(self, perm, obj=None):
        return self.rol == 'admin'

    # Verifica si el usuario tiene permisos para un módulo de la app.
    def has_module_perms(self, app_label):
        return self.rol == 'admin'

    # Hashea la contraseña en texto plano y la guarda en el campo password.
    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    # Verifica si una contraseña en texto plano coincide con el hash almacenado.
    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    # Determina si la cuenta está temporalmente bloqueada por intentos fallidos.
    def is_locked(self):
        if self.locked_until:
            if timezone.now() < self.locked_until:
                return True
        return False

    def clear_lockout(self):
        if self.locked_until and timezone.now() >= self.locked_until:
            self.failed_attempts = 0
            self.locked_until = None
            self.save(update_fields=['failed_attempts', 'locked_until'])

    # Calcula la duración del bloqueo en minutos según cuántas veces se ha bloqueado.
    # La escala es: 15min, 60min, 6h, 24h (se incrementa cada vez que se bloquea).
    def _get_lockout_duration(self):
        # Lista de duraciones en minutos por número de bloqueos.
        durations = [15, 60, 360, 1440]
        # Usa el índice del lockout_count o el último si se pasó del rango.
        index = min(self.lockout_count, len(durations) - 1)
        return durations[index]

    # Incrementa el contador de intentos fallidos. Si llega a 5, bloquea la cuenta.
    def increment_failed_attempts(self):
        # Atomic increment to avoid race conditions between concurrent requests
        Usuario.objects.filter(pk=self.pk).update(failed_attempts=F('failed_attempts') + 1)
        self.refresh_from_db()
        # Si ya falló 5 veces seguidas...
        if self.failed_attempts >= 5:
            # Calcula cuánto tiempo debe estar bloqueada.
            minutes = self._get_lockout_duration()
            # Establece la fecha/hora de desbloqueo de forma atómica.
            Usuario.objects.filter(pk=self.pk).update(
                lockout_count=F('lockout_count') + 1,
                locked_until=timezone.now() + timezone.timedelta(minutes=minutes),
            )
            self.refresh_from_db()

    # Resetea los contadores de intentos fallidos tras un login exitoso.
    def reset_failed_attempts(self):
        self.failed_attempts = 0
        self.locked_until = None
        # Actualiza la fecha del último login.
        self.last_login = timezone.now()
        self.save(update_fields=['failed_attempts', 'locked_until', 'last_login'])

    # Método estático: ejecuta un check_password contra el hash ficticio.
    # Se llama cuando el usuario no existe para igualar tiempos de respuesta.
    @staticmethod
    def dummy_check_password():
        """Check contra hash precomputado para equalizar tiempo de respuesta (CWE-208)."""
        check_password('anything', _DUMMY_HASH)


# ─── MODELO DE NIVELES DEL JUEGO ────────────────────────────────────────
# Representa los niveles/disparadores del juego. Cada nivel tiene un
# nombre, dificultad y opcionalmente un tiempo límite.
class Nivel(models.Model):
    # Opciones de dificultad disponibles.
    DIFICULTAD = [
        ('facil', 'Fácil'),
        ('medio', 'Medio'),
        ('dificil', 'Difícil'),
    ]
    # Nombre del nivel (ej: "La Guarida del Pulpo").
    nombre = models.CharField(max_length=100)
    # Nivel de dificultad con valor por defecto 'facil'.
    dificultad = models.CharField(max_length=10, choices=DIFICULTAD, default='facil')
    # Tiempo límite en segundos para completar el nivel (opcional).
    tiempo_limite = models.IntegerField(blank=True, null=True)
    # Fecha de creación automática.
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    # Nombre de la tabla en la BD.
    class Meta:
        db_table = 'niveles'

    def __str__(self):
        return self.nombre


# ─── MODELO DE PARTIDAS ─────────────────────────────────────────────────
# Almacena cada partida jugada por un usuario en un nivel específico.
# Registra muertes, tiempo empleado y puntuación obtenida.
class Partida(models.Model):
    # Relación con el usuario que jugó la partida (cascade = borrar partidas si se borra el usuario).
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='usuario_id')
    # Relación con el nivel en el que se jugó.
    nivel = models.ForeignKey(Nivel, on_delete=models.CASCADE, db_column='nivel_id')
    # Número de muertes del jugador en esa partida.
    muertes = models.IntegerField(default=0)
    # Tiempo empleado en segundos (opcional).
    tiempo = models.IntegerField(blank=True, null=True)
    # Puntuación obtenida (opcional).
    puntuacion = models.IntegerField(blank=True, null=True)
    # Fecha/hora en que se jugó la partida.
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'partidas'
        # Índices para acelerar consultas frecuentes:
        indexes = [
            # Buscar partidas de un usuario ordenadas por fecha reciente.
            models.Index(fields=['usuario', '-fecha'], name='idx_partida_usuario_fecha'),
            # Buscar partidas de un nivel ordenadas por fecha reciente.
            models.Index(fields=['nivel', '-fecha'], name='idx_partida_nivel_fecha'),
            # Ranking global: ordenar todas las partidas por puntuación.
            models.Index(fields=['-puntuacion'], name='idx_partida_puntuacion'),
        ]

    def __str__(self):
        # Muestra "usuario - nivel" como representación de texto.
        return f"{self.usuario.username} - {self.nivel.nombre}"


# ─── MODELO DE CONFIRMACIÓN DE RESET DE CONTRASEÑA ──────────────────────
# Almacena tokens de confirmación para el flujo de recuperación de contraseña.
# Se crea un registro cuando el usuario solicita resetear su contraseña.
class ConfirmacionReset(models.Model):
    # Hash SHA-256 del token UUID. Es la clave primaria (el token real viaja por email).
    token_hash = models.CharField(max_length=64, primary_key=True)
    # Hash SHA-256 del código de verificación (para flujo de 2 pasos).
    codigo_hash = models.CharField(max_length=64, db_index=True, null=True)
    # Referencia al usuario que solicitó el reset.
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    # Fecha/hora de creación del token (para calcular expiración).
    created_at = models.DateTimeField(auto_now_add=True)
    # Indica si el usuario ya confirmó su identidad haciendo clic en el email.
    confirmado = models.BooleanField(default=False)

    # Tiempo de vida del token: 15 minutos.
    TOKEN_EXPIRY_MINUTES = 15

    class Meta:
        db_table = 'confirmaciones_reset'

    def __str__(self):
        return f"Reset for {self.usuario.username}"

    # Propiedad que verifica si el token ha expirado (>15 minutos desde creación).
    @property
    def is_expired(self):
        return timezone.now() > self.created_at + timezone.timedelta(minutes=self.TOKEN_EXPIRY_MINUTES)

    # Método de clase que verifica si un código dado coincide con uno almacenado.
    # Recibe el email del usuario y el código en texto plano.
    @classmethod
    def verificar_codigo(cls, email: str, codigo: str) -> bool:
        # Hashea el código para compararlo con el hash guardado en la BD.
        h = hashlib.sha256(codigo.encode()).hexdigest()
        # Busca un registro que coincida con: hash del código, email del usuario,
        # que el usuario esté activo, y que no haya expirado.
        return cls.objects.filter(
            codigo_hash=h,
            usuario__email__iexact=email,
            usuario__is_active=True,
            created_at__gte=timezone.now() - timezone.timedelta(minutes=cls.TOKEN_EXPIRY_MINUTES),
        ).exists()
