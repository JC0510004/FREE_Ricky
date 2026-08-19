from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_add_partida_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='confirmacionreset',
            name='confirmado',
            field=models.BooleanField(default=False),
        ),
    ]
