"""
Single source de verdad para choices de filtros compartidos entre
production, quality y maintenance.

BU_CHOICES se deriva de BusinessUnit (apps.quality.cogp.models.customer_part_mapping)
-- nunca hardcodear la lista de BUs en otro lugar.
"""
from apps.quality.cogp.models.customer_part_mapping import BusinessUnit

BU_CHOICES = BusinessUnit.choices