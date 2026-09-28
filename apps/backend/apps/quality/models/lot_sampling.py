from django.db import models


class QWallLotSetting(models.Model):
    """One independent lot policy per CCS business unit (logical ID)."""
    bu_id = models.PositiveIntegerField(unique=True)
    mode = models.CharField(max_length=10, choices=[('GENERAL', 'General'), ('BY_MODEL', 'By model')], default='GENERAL')
    general_lot_size = models.PositiveIntegerField(null=True, blank=True)
    inspection_index = models.CharField(max_length=5, default='2.5')
    enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quality_qwall_lot_setting'


class QWallLotModelSetting(models.Model):
    setting = models.ForeignKey(QWallLotSetting, related_name='models', on_delete=models.CASCADE)
    pn_id = models.PositiveIntegerField()  # Logical reference to CCS ssi_PartNumbers
    lot_size = models.PositiveIntegerField()

    class Meta:
        db_table = 'quality_qwall_lot_model_setting'
        constraints = [models.UniqueConstraint(fields=['setting', 'pn_id'], name='uq_qwall_lot_model')]


class QWallSamplingCell(models.Model):
    lot_min = models.PositiveIntegerField()
    lot_max = models.PositiveIntegerField(null=True, blank=True)
    inspection_index = models.CharField(max_length=5)
    sample_size = models.PositiveIntegerField(null=True, blank=True)  # NULL = inspect entire lot (*)

    class Meta:
        db_table = 'quality_qwall_sampling_cell'
        constraints = [models.UniqueConstraint(fields=['lot_min', 'inspection_index'], name='uq_qwall_sampling_cell')]
