from django.contrib import admin
from apps.production.models import (
    BusinessUnit, WeeklyTarget, WeeklyWIP,
    SafetySettings, SafetyIncident,
    PlantEmployee, AttendanceRecord,
)

admin.site.register(BusinessUnit)
admin.site.register(WeeklyTarget)
admin.site.register(WeeklyWIP)
admin.site.register(SafetySettings)
admin.site.register(SafetyIncident)
admin.site.register(PlantEmployee)
admin.site.register(AttendanceRecord)