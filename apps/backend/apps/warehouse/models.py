from django.db import models


class StorageLayout(models.Model):
    """Configuración única del almacén y sus preferencias de visualización."""

    designer_enabled = models.BooleanField(default=False)
    initial_racks_seeded = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warehouse_storage_layout"


class StorageRack(models.Model):
    """Rack físico con coordenadas normalizadas."""

    number = models.PositiveSmallIntegerField(unique=True)
    name = models.CharField(max_length=80, blank=True, default='')
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
    standard_pallets = models.PositiveSmallIntegerField(default=0)
    euro_pallets = models.PositiveSmallIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warehouse_storage_location"
        constraints = [
            models.UniqueConstraint(fields=["rack", "level"], name="warehouse_unique_rack_level"),
        ]
