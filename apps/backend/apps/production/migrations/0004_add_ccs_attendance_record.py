from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("production", "0003_add_oee_record"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CcsAttendanceRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("ccs_employee_id", models.IntegerField(verbose_name="SQL Server employee ID")),
                ("date", models.DateField(verbose_name="Fecha")),
                ("turno", models.CharField(max_length=1)),
                ("status", models.CharField(
                    choices=[("present","Present"),("absent","Absent"),("leave","Leave"),("sick","Sick")],
                    default="present", max_length=20,
                )),
                ("hours", models.DecimalField(decimal_places=2, default=12.0, max_digits=5)),
                ("recorded_at", models.DateTimeField(auto_now=True)),
                ("recorded_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="ccs_attendance_records",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "production_ccs_attendance", "ordering": ["-date"]},
        ),
        migrations.AddConstraint(
            model_name="ccsattendancerecord",
            constraint=models.UniqueConstraint(
                fields=["ccs_employee_id", "date"],
                name="unique_ccs_employee_date",
            ),
        ),
    ]
