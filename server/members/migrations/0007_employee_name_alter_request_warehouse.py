# Generated by Django 4.2.3 on 2023-07-26 17:30

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('members', '0006_remove_schedule_warehouse_request_warehouse'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='name',
            field=models.CharField(default='default', max_length=64),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='request',
            name='warehouse',
            field=models.ForeignKey(default='56db5f46-f68a-475a-a76e-4c5f6da3e80d', on_delete=django.db.models.deletion.CASCADE, to='members.warehouse'),
        ),
    ]