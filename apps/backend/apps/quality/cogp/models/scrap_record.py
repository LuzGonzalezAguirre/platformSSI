from django.db import models
from .customer_part_mapping import BusinessUnit


class ScrapRecord(models.Model):
    report_date = models.DateField(db_index=True)
    scrap_date = models.DateTimeField()
    part_no = models.CharField(max_length=50, db_index=True)
    part_type = models.CharField(max_length=100, blank=True)
    serial_no = models.CharField(max_length=50, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    weight = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    scrap_reason = models.CharField(max_length=255, blank=True)
    workcenter = models.CharField(max_length=255, blank=True)
    workcenter_group = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=5, null=True, blank=True)
    extended_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    note = models.TextField(blank=True)
    business_unit = models.CharField(
        max_length=20, choices=BusinessUnit.choices, db_index=True
    )
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cogp_scrap_record"
        constraints = [
            models.UniqueConstraint(
                fields=["report_date", "serial_no", "scrap_date", "part_no"],
                name="uq_scrap_record_dedup",
            )
        ]
        indexes = [
            models.Index(fields=["report_date", "business_unit"]),
        ]

    def __str__(self):
        return f"{self.part_no} scrap {self.quantity} @ {self.report_date}"