from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0010_confirmacionreset_failed_attempts_verificacionemail'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='desactivado_por_admin',
            field=models.BooleanField(default=False),
        ),
    ]
