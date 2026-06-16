from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_lockout_escalable'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConfirmacionReset',
            fields=[
                ('token_hash', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('codigo_hash', models.CharField(db_index=True, max_length=64, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'confirmaciones_reset',
            },
        ),
    ]
