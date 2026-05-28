from django.db import models

class Usuario(models.Model):
    ROL_CHOICES = [
    ('admin', 'Admin'),
    ('jugador', 'Jugador'),
    ]
    rol = models.CharField(max_length=10, choices=ROL_CHOICES, default='jugador')
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(max_length=100, blank=True, null=True)
    password = models.CharField(max_length=255)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'usuarios'

    def __str__(self):
        return self.username


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