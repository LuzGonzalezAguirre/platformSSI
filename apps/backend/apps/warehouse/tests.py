from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.warehouse.models import StorageLocation, StorageRack
from apps.warehouse.views.storage_utilization import serialize_rack


class MixedPalletCalculationTests(TestCase):
    def setUp(self):
        self.rack = StorageRack.objects.create(number=1)
        for level in range(1, 5):
            StorageLocation.objects.create(rack=self.rack, level=level)

    def test_mixed_pallets_represent_83_percent(self):
        location = self.rack.locations.get(level=1)
        location.standard_pallets = 1
        location.euro_pallets = 1
        location.save()
        rack = StorageRack.objects.prefetch_related("locations").get(pk=self.rack.pk)
        self.assertEqual(serialize_rack(rack)["levels"][0]["utilization"], 83.33)

    def test_two_standard_pallets_are_full(self):
        location = self.rack.locations.get(level=2)
        location.standard_pallets = 2
        location.save()
        rack = StorageRack.objects.prefetch_related("locations").get(pk=self.rack.pk)
        self.assertEqual(serialize_rack(rack)["levels"][1]["utilization"], 100)
