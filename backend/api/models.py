# ─── MODELOS DE BASE DE DATOS ───────────────────────────────────────────
# Este archivo define todos los modelos (tablas) de la aplicación usando
# el ORM de Django. Cada clase representa una tabla en la base de datos.

# Importamos los módulos necesarios de Django para crear modelos,
# hashear contraseñas y manejar el tiempo.
from django.db import models, transaction
from django.db.models import F
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone


# ─── GESTOR DE USUARIOS PERSONALIZADO ───────────────────────────────────
# Django necesita un manager personalizado porque usamos AbstractBaseUser
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
    # Marca que la desactivación la decidió un administrador, y no el propio
    # usuario. Sin este campo, is_active=False no distinguishía "el admin me
    # cerró la cuenta" de "cerré mi cuenta y quiero volver", y el registro
    # público (RegisterSerializer.create) reactivaba la fila en ambos casos:
    # bastaba con volver a registrarse con el mismo username/email para
    # deshacer una decisión del admin. Con la marca, esa reactivación se
    # rechaza y solo un administrador puede revertirla.
    desactivado_por_admin = models.BooleanField(default=False)
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

    # Mantiene la invariante desactivado_por_admin => cuenta cerrada.
    #
    # La marca solo significa algo con la cuenta cerrada: una cuenta ACTIVA con
    # la marca puesta es una contradiccion, y es exactamente la deriva que se
    # abria desde el panel de admin, donde is_active se alterna a mano. Al
    # guardar una cuenta activa se limpia la marca, de modo que reactivar es
    # siempre una decision del administrador y esa decision revoca la anterior
    # en el mismo guardado. No hay caso legitimo que se pierda: toda cerradura
    # de admin escribe is_active=False junto con la marca
    # (views_users.py:195-197) y las reactivaciones (VerificarEmailView,
    # RegisterSerializer) ya rechazan antes las cuentas marcadas.
    def save(self, *args, **kwargs):
        if self.is_active and self.desactivado_por_admin:
            self.desactivado_por_admin = False
            # Si el llamante guardo con update_fields, hay que añadir el campo
            # al conjunto: sin eso la normalizacion se queda solo en memoria y
            # la deriva sigue viva en la base de datos.
            campos = kwargs.get('update_fields')
            if campos is not None:
                kwargs['update_fields'] = set(campos) | {'desactivado_por_admin'}
        super().save(*args, **kwargs)

    # Verifica si el usuario tiene un permiso específico. Solo admins tienen permisos.
    def has_perm(self, perm, obj=None):
        return self.rol == 'admin'

    # Verifica si el usuario tiene permisos para un módulo de la app.
    def has_module_perms(self, app_label):
        return self.rol == 'admin'

    # Propiedades que exige el admin de Django (login, has_permission, etc.).
    # Se derivan del rol: un usuario con rol 'admin' es staff y superuser.
    # Sin estas propiedades, el login del panel admin revienta con AttributeError.
    # Son propiedades (no campos): no requieren migración.
    @property
    def is_staff(self):
        return self.rol == 'admin'

    @property
    def is_superuser(self):
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
    # Maximo de intentos antes de bloquear la cuenta.
    MAX_INTENTOS_FALLIDOS = 5

    def increment_failed_attempts(self):
        # El incremento del contador SI era atomico (F('failed_attempts') + 1),
        # pero la decision de bloquear no lo era, y ahi estaba el problema:
        # el "if self.failed_attempts >= 5" se evaluaba sobre el valor releido
        # y N peticiones concurrentes que llegaban con el contador ya cerca del
        # umbral incrementaban todas, todas pasaban el ">= 5", y cada una
        # bumpeaba lockout_count y sobrescribia locked_until. Una sola oleada
        # de 5 intentos en paralelo hacia saltar cinco peldanos de la escalera
        # (15min -> 60min -> 6h -> 24h) y dejaba la cuenta bloqueada 24h en vez
        # de 15min. O sea, el atacante (o un usuario con varias pestanas
        # fallando a la vez) podia escalar el bloqueo hasta el maximo de un
        # plumazo, y ademas el write de locked_until se pisaba a si mismo
        # dejando un valor incoherente respecto a lockout_count.
        #
        # Aqui la comprobacion del umbral y la escritura del bloqueo se hacen
        # bajo bloqueo de fila (select_for_update) y dentro de la misma
        # transaccion, de modo que son indivisibles. El "not row.is_locked()"
        # evita ademas re-escalar si ya habia un bloqueo en curso.
        with transaction.atomic():
            row = Usuario.objects.select_for_update().get(pk=self.pk)

            row.failed_attempts = F('failed_attempts') + 1
            row.save(update_fields=['failed_attempts'])
            row.refresh_from_db()

            if (row.failed_attempts >= self.MAX_INTENTOS_FALLIDOS
                    and not row.is_locked()):
                minutes = row._get_lockout_duration()
                row.lockout_count = F('lockout_count') + 1
                row.locked_until = timezone.now() + timezone.timedelta(minutes=minutes)
                row.save(update_fields=['lockout_count', 'locked_until'])
                row.refresh_from_db()

        # Propagamos el estado real a la instancia en memoria para que el
        # llamante (la vista de login, que lo registra en el log) vea los
        # valores definitivos y no los previos a la operacion.
        self.failed_attempts = row.failed_attempts
        self.lockout_count = row.lockout_count
        self.locked_until = row.locked_until

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
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='usuario_id')
    nivel = models.ForeignKey(Nivel, on_delete=models.CASCADE, db_column='nivel_id')
    muertes = models.IntegerField(default=0)
    tiempo = models.IntegerField(blank=True, null=True)
    puntuacion = models.IntegerField(blank=True, null=True)
    completado = models.BooleanField(default=False)   # 👈 NUEVO
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'partidas'
        indexes = [
            models.Index(fields=['usuario', '-fecha'], name='idx_partida_usuario_fecha'),
            models.Index(fields=['nivel', '-fecha'], name='idx_partida_nivel_fecha'),
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
    # Hash SHA-256 del código numérico de 6 dígitos (segundo factor de verificación).
    # El código viaja en el mismo email que el enlace y se exige al fijar la nueva
    # contraseña, de forma que el restablecimiento requiere clic en el enlace + código.
    codigo_hash = models.CharField(max_length=64, db_index=True, null=True)
    # Referencia al usuario que solicitó el reset.
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    # Fecha/hora de creación del token (para calcular expiración).
    created_at = models.DateTimeField(auto_now_add=True)
    # Indica si el usuario ya confirmó su identidad haciendo clic en el email.
    confirmado = models.BooleanField(default=False)
    # Intentos fallidos al verificar el código de 6 dígitos. Cuando alcanzan el
    # máximo (MAX_INTENTOS_CODIGO) el registro se invalida: hace inviable la
    # fuerza bruta del código buscando el número correcto por el endpoint.
    failed_attempts = models.IntegerField(default=0)

    # Tiempo de vida del token: 15 minutos.
    TOKEN_EXPIRY_MINUTES = 15
    # Máximo de fallos al adivinar el código antes de invalidar el token.
    MAX_INTENTOS_CODIGO = 10

    class Meta:
        db_table = 'confirmaciones_reset'

    def __str__(self):
        return f"Reset for {self.usuario.username}"

    # Propiedad que verifica si el token ha expirado (>15 minutos desde creación).
    @property
    def is_expired(self):
        return timezone.now() > self.created_at + timezone.timedelta(minutes=self.TOKEN_EXPIRY_MINUTES)

    # Incrementa el contador de fallos de código de forma atómica (bloquea la
    # fila) y devuelve el total. Evita que peticiones concurrentes pierdan fallos.
    def incrementar_intentos_fallidos(self):
        type(self).objects.filter(pk=self.pk).update(failed_attempts=F('failed_attempts') + 1)
        self.refresh_from_db()
        return self.failed_attempts

    # NOTA: este modelo NO expone ningún método para validar un código a partir
    # del email. Existió uno (verificar_codigo) y se eliminó porque era código
    # muerto con dos defectos de seguridad: comparaba el hash del código dentro
    # de la consulta SQL (en vez de con hmac.compare_digest en tiempo constante)
    # y NO contaba los intentos fallidos, esquivando por completo el bloqueo
    # anti fuerza bruta de MAX_INTENTOS_CODIGO. La única ruta de validación
    # válida es api.views_password_reset (comparación en tiempo constante +
    # _registrar_fallo_codigo sobre este mismo contador).


# ─── MODELO DE VERIFICACIÓN DE EMAIL ──────────────────────────────────────
# Token de un solo uso para confirmar la propiedad del correo. Se emite en el
# registro y en la reactivación de cuentas desactivadas (en ese caso, además,
# es la llave que vuelve a activar la cuenta). Guarda solo el hash SHA-256
# por si el token se filtra en la base de datos.
class VerificacionEmail(models.Model):
    # Hash SHA-256 del token UUID: clave primaria (el token real viaja por email).
    token_hash = models.CharField(max_length=64, primary_key=True)
    # Usuario que debe confirmar su correo.
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    # Fecha/hora de emisión (para calcular expiración).
    created_at = models.DateTimeField(auto_now_add=True)

    # Tiempo de vida del token: 60 minutos.
    TOKEN_EXPIRY_MINUTES = 60

    class Meta:
        db_table = 'verificaciones_email'

    def __str__(self):
        return f"Verificación de email para {self.usuario.username}"

    @property
    def is_expired(self):
        return timezone.now() > self.created_at + timezone.timedelta(minutes=self.TOKEN_EXPIRY_MINUTES)
