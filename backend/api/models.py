from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone


class UsuarioManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError('El email es obligatorio')
        email = self.normalize_email(email)
        usuario = self.model(username=username, email=email, **extra_fields)
        if password:
            usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('rol', 'admin')
        extra_fields.setdefault('is_active', True)
        return self.create_user(username, email, password, **extra_fields)


class Usuario(AbstractBaseUser):
    ROL_CHOICES = [
        ('admin', 'Admin'),
        ('jugador', 'Jugador'),
    ]

    rol = models.CharField(max_length=10, choices=ROL_CHOICES, default='jugador')
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(max_length=100, unique=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    failed_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    objects = UsuarioManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'usuarios'

    def __str__(self):
        return self.username

    def has_perm(self, perm, obj=None):
        return self.rol == 'admin'

    def has_module_perms(self, app_label):
        return self.rol == 'admin'

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    def is_locked(self):
        if self.locked_until and timezone.now() < self.locked_until:
            return True
        return False

    def increment_failed_attempts(self):
        self.failed_attempts += 1
        if self.failed_attempts >= 5:
            self.locked_until = timezone.now() + timezone.timedelta(minutes=15)
        self.save(update_fields=['failed_attempts', 'locked_until'])

    def reset_failed_attempts(self):
        self.failed_attempts = 0
        self.locked_until = None
        self.last_login = timezone.now()
        self.save(update_fields=['failed_attempts', 'locked_until', 'last_login'])


class Nivel(models.Model):
    DIFICULTAD = [
        ('facil', 'Fácil'),
        ('medio', 'Medio'),
        ('dificil', 'Difícil'),
    ]
    nombre = models.CharField(max_length=100)
    dificultad = models.CharField(max_length=10, choices=DIFICULTAD, default='facil')
    tiempo_limite = models.IntegerField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'niveles'

    def __str__(self):
        return self.nombre


class Partida(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='usuario_id')
    nivel = models.ForeignKey(Nivel, on_delete=models.CASCADE, db_column='nivel_id')
    muertes = models.IntegerField(default=0)
    tiempo = models.IntegerField(blank=True, null=True)
    puntuacion = models.IntegerField(blank=True, null=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'partidas'

    def __str__(self):
        return f"{self.usuario.username} - {self.nivel.nombre}"