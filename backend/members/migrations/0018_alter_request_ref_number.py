from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('members', '0017_request_appointment_length'),
    ]

    operations = [
        migrations.AlterField(
            model_name='request',
            name='ref_number',
            field=models.TextField(default=""),
        ),
    ]
