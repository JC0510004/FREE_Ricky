from django.contrib import admin

from config.admin_site import secure_admin_site

from .models import Usuario, Nivel, Partida


class UsuarioAdmin(admin.ModelAdmin):
    list_display = ['id', 'username', 'email', 'rol', 'is_active', 'is_verified', 'failed_attempts', 'last_login']
    list_filter = ['rol', 'is_active', 'is_verified']
    search_fields = ['username', 'email']
    ordering = ['-fecha_registro']
    readonly_fields = ['password', 'fecha_registro', 'last_login', 'failed_attempts', 'locked_until']


class NivelAdmin(admin.ModelAdmin):
    list_display = ['id', 'nombre', 'dificultad', 'tiempo_limite']
    list_filter = ['dificultad']


class PartidaAdmin(admin.ModelAdmin):
    list_display = ['id', 'usuario', 'nivel', 'puntuacion', 'muertes', 'fecha']
    list_filter = ['fecha']
    search_fields = ['usuario__username', 'nivel__nombre']


# Se registran en el AdminSite endurecido (con throttle/lockout en unico login)
# en lugar del admin.site por defecto.
secure_admin_site.register(Usuario, UsuarioAdmin)
secure_admin_site.register(Nivel, NivelAdmin)
secure_admin_site.register(Partida, PartidaAdmin)
