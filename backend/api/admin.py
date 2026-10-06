from django.contrib import admin

from config.admin_site import secure_admin_site

from .models import Usuario, Nivel, Partida


class UsuarioAdmin(admin.ModelAdmin):
    list_display = ['id', 'username', 'email', 'rol', 'is_active', 'desactivado_por_admin',
                    'is_verified', 'failed_attempts', 'last_login']
    list_filter = ['rol', 'is_active', 'is_verified']
    search_fields = ['username', 'email']
    ordering = ['-fecha_registro']
    # desactivado_por_admin es de solo lectura: solo lo escribe codigo
    # (views_users.py:195-197). Editable a mano, el panel era el sitio donde
    # las dos banderas de estado podian desincronizarse.
    readonly_fields = ['password', 'fecha_registro', 'last_login', 'failed_attempts',
                       'locked_until', 'desactivado_por_admin']

    def save_model(self, request, obj, form, change):
        # is_active se alterna a mano aqui y la marca no, asi que quien cierre
        # la cuenta desde el panel tiene que dejarla marcada: sin la marca,
        # RegisterSerializer reactiva la cuenta con solo volver a registrarse
        # y el cierre no vale nada. Y al reactivar, la marca se limpia (lo hace
        # Usuario.save), porque reactivar es decision del administrador.
        original = (
            Usuario.objects.filter(pk=obj.pk).values_list('is_active', flat=True).first()
            if change else None
        )
        if original is not None and original != obj.is_active:
            obj.desactivado_por_admin = not obj.is_active
        super().save_model(request, obj, form, change)


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
