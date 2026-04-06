from django.db import models


class PlantEmployee(models.Model):
    class Turno(models.TextChoices):
        A = "A", "Turno A"
        B = "B", "Turno B"

    name       = models.CharField(max_length=150, verbose_name="Nombre completo")
    department = models.CharField(max_length=100, default="Assembly")
    turno      = models.CharField(max_length=1, choices=Turno.choices, default=Turno.A)
    user       = models.OneToOneField(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="plant_employee",
        verbose_name="Usuario del sistema (opcional)",
    )
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table  = "production_plant_employee"
        ordering  = ["name"]
        verbose_name = "Plant Employee"
        verbose_name_plural = "Plant Employees"

    def __str__(self):
        return f"{self.name} (Turno {self.turno})"


class AttendanceRecord(models.Model):
    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT  = "absent",  "Absent"
        LEAVE   = "leave",   "Leave"
        SICK    = "sick",    "Sick"

    class Shift(models.TextChoices):
        FULL     = "full",     "Full"
        PARTIAL  = "partial",  "Partial"
        OVERTIME = "overtime", "Overtime"
        NONE     = "none",     "—"

    employee   = models.ForeignKey(
        PlantEmployee,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    date       = models.DateField(verbose_name="Fecha")
    status     = models.CharField(max_length=20, choices=Status.choices, default=Status.PRESENT)
    shift      = models.CharField(max_length=20, choices=Shift.choices, default=Shift.FULL)
    hours      = models.DecimalField(max_digits=4, decimal_places=1, default=12.0)
    recorded_by = models.ForeignKey(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="attendance_records_entered",
    )
    recorded_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table      = "production_attendance_record"
        unique_together = ("employee", "date")
        ordering      = ["-date", "employee__name"]
        verbose_name  = "Attendance Record"

    def __str__(self):
        return f"{self.employee.name} — {self.date} ({self.status})"

class EarnedHoursRecord(models.Model):
    date        = models.DateField(unique=True, verbose_name="Fecha")
    earned_hours = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    notes       = models.CharField(max_length=200, blank=True)
    recorded_by = models.ForeignKey(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="earned_hours_records",
    )
    recorded_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = "production_earned_hours_record"
        ordering     = ["-date"]
        verbose_name = "Earned Hours Record"

    def __str__(self):
        return f"{self.date} — {self.earned_hours} hrs"
    
