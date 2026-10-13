from django.db import models


class StorageLayout(models.Model):
    """Configuración única del almacén y sus preferencias de visualización."""

    designer_enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warehouse_storage_layout"


class StorageRack(models.Model):
    """Rack físico con coordenadas normalizadas y tipo de pallet."""

    EURO = "euro"
    STANDARD = "standard"
    PALLET_TYPES = [(EURO, "Euro pallet"), (STANDARD, "Standard pallet")]

    number = models.PositiveSmallIntegerField(unique=True)
    pallet_type = models.CharField(max_length=8, choices=PALLET_TYPES, default=EURO)
    x = models.FloatField(null=True, blank=True)
    y = models.FloatField(null=True, blank=True)
    width = models.FloatField(default=7.5)
    height = models.FloatField(default=12)
    rotation = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "warehouse_storage_rack"
        ordering = ["number"]


class StorageLocation(models.Model):
    """Conteo de pallets por nivel, persistido independientemente del layout."""

    rack = models.ForeignKey(StorageRack, related_name="locations", on_delete=models.CASCADE)
    level = models.PositiveSmallIntegerField()
    pallet_count = models.PositiveSmallIntegerField(default=0)  # Legacy: migrated to split counts
    standard_pallets = models.PositiveSmallIntegerField(default=0)
    euro_pallets = models.PositiveSmallIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warehouse_storage_location"
        constraints = [
            models.UniqueConstraint(fields=["rack", "level"], name="warehouse_unique_rack_level"),
        ]
