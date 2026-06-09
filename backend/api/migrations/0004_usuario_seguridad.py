# Generated manually - Security migration
# Adds security fields and constraints

from django.db import migrations, models


def migrar_emails(apps, schema_editor):
    Usuario = apps.get_model('api', 'Usuario')
    for usuario in Usuario.objects.filter(email__isnull=True):
        usuario.email = f"usuario_{usuario.id}@placeholder.com"
        usuario.save(update_fields=['email'])


def migrar_passwords(apps, schema_editor):
    from django.contrib.auth.hashers import make_password
    Usuario = apps.get_model('api', 'Usuario')
    for usuario in Usuario.objects.all():
        if usuario.password and not usuario.password.startswith('pbkdf2_'):
            usuario.password = make_password(usuario.password)
            usuario.save(update_fields=['password'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_usuario_rol'),
    ]

    operations = [
        migrations.RunPython(migrar_emails),
        migrations.RunPython(migrar_passwords),
        migrations.AddField(
            model_name='usuario',
            name='failed_attempts',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='usuario',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='usuario',
            name='is_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='usuario',
            name='last_login',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='usuario',
            name='locked_until',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='usuario',
            name='email',
            field=models.EmailField(max_length=100, unique=True),
        ),
    ]
