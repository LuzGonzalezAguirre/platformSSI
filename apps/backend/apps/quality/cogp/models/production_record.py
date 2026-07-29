from django.db import models
from .customer_part_mapping import BusinessUnit


class ProductionRecord(models.Model):
    report_date = models.DateField(db_index=True)
    part_no = models.CharField(max_length=50, db_index=True)
    workcenter = models.CharField(max_length=255, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    extended_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    cost_model_key = models.IntegerField()
    business_unit = models.CharField(
        max_length=20, choices=BusinessUnit.choices, db_index=True
    )
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cogp_production_record"
        constraints = [
            models.UniqueConstraint(
                fields=["report_date", "part_no", "workcenter"],
                name="uq_production_record_dedup",
            )
        ]
        indexes = [
            models.Index(fields=["report_date", "business_unit"]),
        ]

    def __str__(self):
        return f"{self.part_no} prod {self.quantity} @ {self.report_date}"