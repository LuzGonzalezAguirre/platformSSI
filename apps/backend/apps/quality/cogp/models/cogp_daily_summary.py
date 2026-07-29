from django.db import models
from .customer_part_mapping import BusinessUnit


class COGPDailySummary(models.Model):
    report_date = models.DateField(db_index=True)
    business_unit = models.CharField(
        max_length=20, choices=BusinessUnit.choices, db_index=True
    )
    scrap_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    extended_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cogp_pct = models.DecimalField(
        max_digits=7, decimal_places=3, null=True, blank=True
    )  # NULL si extended_cost = 0 — nunca asumir 0%
    calculated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cogp_daily_summary"
        constraints = [
            models.UniqueConstraint(
                fields=["report_date", "business_unit"],
                name="uq_cogp_summary_dedup",
            )
        ]
        indexes = [
            models.Index(fields=["report_date", "business_unit"]),
        ]

    def __str__(self):
        pct = f"{self.cogp_pct}%" if self.cogp_pct is not None else "N/A"
        return f"{self.business_unit} {self.report_date}: {pct}"