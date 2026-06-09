from django.contrib import admin
from .models import Usuario, Nivel, Partida


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ['id', 'username', 'email', 'rol', 'is_active', 'is_verified', 'failed_attempts', 'last_login']
    list_filter = ['rol', 'is_active', 'is_verified']
    search_fields = ['username', 'email']
    ordering = ['-fecha_registro']
    readonly_fields = ['password', 'fecha_registro', 'last_login', 'failed_attempts', 'locked_until']


@admin.register(Nivel)
class NivelAdmin(admin.ModelAdmin):
    list_display = ['id', 'nombre', 'dificultad', 'tiempo_limite']
    list_filter = ['dificultad']


@admin.register(Partida)
class PartidaAdmin(admin.ModelAdmin):
    list_display = ['id', 'usuario', 'nivel', 'puntuacion', 'muertes', 'fecha']
    list_filter = ['fecha']
    search_fields = ['usuario__username', 'nivel__nombre']
