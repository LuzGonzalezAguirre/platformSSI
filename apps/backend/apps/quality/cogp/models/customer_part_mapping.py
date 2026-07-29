from django.db import models


class BusinessUnit(models.TextChoices):
    VOLVO = "VOLVO", "Volvo"
    JOHN_DEERE = "JOHN_DEERE", "John Deere"
    CUMMINS = "CUMMINS", "Cummins"
    HARLEY_DAVIDSON = "HARLEY_DAVIDSON", "Harley-Davidson"
    EATON = "EATON", "Eaton"
    TULC = "TULC", "TULC"
    SPEED = "SPEED", "Speed"


class ClassificationSource(models.TextChoices):
    CUSTOMER_NO = "CUSTOMER_NO", "Customer_No directo"
    NAME_FALLBACK = "NAME_FALLBACK", "Nombre (fallback)"
    UNMAPPED = "UNMAPPED", "Sin clasificar"


class CustomerPartMapping(models.Model):
    part_no = models.CharField(max_length=50, unique=True, db_index=True)
    part_name = models.CharField(max_length=255, blank=True)
    part_status = models.CharField(max_length=50, blank=True)
    customer_no = models.IntegerField(null=True, blank=True)
    customer_name = models.CharField(max_length=255, blank=True)
    business_unit = models.CharField(
        max_length=20, choices=BusinessUnit.choices, db_index=True
    )
    classification_source = models.CharField(
        max_length=20, choices=ClassificationSource.choices,
        default=ClassificationSource.UNMAPPED, db_index=True,
    )
    last_synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cogp_customer_part_mapping"
        indexes = [
            models.Index(fields=["business_unit"]),
        ]

    def __str__(self):
        return f"{self.part_no} → {self.business_unit}"