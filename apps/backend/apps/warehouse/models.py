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


class DeliveryAction(models.Model):
    """Action attached to a specific OTD chart bar, independent of Plex snapshots."""
    CHARTS = [
        ("monthlyCustomers", "Monthly OTD by Customer"),
        ("weeklyCustomers", "Weekly OTD by Customer"),
        ("weeklyTrend", "Weekly Trend"),
        ("monthlyTrend", "Monthly Trend"),
    ]
    chart = models.CharField(max_length=32, choices=CHARTS)
    period_key = models.CharField(max_length=16)
    customer = models.CharField(max_length=180, blank=True, default="")
    reason = models.TextField()
    task = models.TextField()
    responsible = models.CharField(max_length=160)
    start_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=32, default="Pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warehouse_delivery_action"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["chart", "period_key", "customer"], name="warehouse_otd_action_lookup")]


class DemandReleaseAlert(models.Model):
    """Release first seen in the active shipping month; delivery is retryable."""

    release_key = models.BigIntegerField(unique=True)
    ship_month = models.DateField(db_index=True)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=16, default="pending", db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")
    first_seen_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "warehouse_demand_release_alert"
        ordering = ["first_seen_at"]


class DemandAlertSyncState(models.Model):
    """Persist first-run baseline for each shipping month."""
    ship_month = models.DateField(unique=True)
    seeded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "warehouse_demand_alert_sync_state"
