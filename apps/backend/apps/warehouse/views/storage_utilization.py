from django.db import transaction
import math
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.permissions.drf import module_permission
from apps.warehouse.models import StorageLayout, StorageLocation, StorageRack

# Datos iniciales del Excel. El resto de las ubicaciones se marca completo.
# La proporción 67% no identifica de forma inequívoca el tipo de pallet:
# se inicializa como europallet (2 de 3) y queda editable por rack.
OVERRIDES = {
    (1, 2): 67, (1, 3): 67,
    (2, 1): 33, (2, 2): 67,
    (16, 3): 67, (17, 4): 67,
    (22, 4): 50, (24, 2): 67, (26, 2): 67,
    (31, 4): 50, (32, 4): 67,
    (34, 3): 67, (36, 3): 67, (36, 4): 67,
    (43, 2): 67, (43, 4): 67,
    (45, 4): 50, (47, 2): 50, (47, 3): 50,
    (53, 1): 0, (53, 2): 0,
    (54, 1): 0, (54, 3): 50,
    (55, 3): 0,
}

def location_name_available(name, exclude_number=None):
    normalized = name.strip().casefold()
    return not any(
        (rack.name or f"TJR{rack.number}").casefold() == normalized
        for rack in StorageRack.objects.all()
        if rack.number != exclude_number
    )


def serialize_rack(rack):
    locations = sorted(rack.locations.all(), key=lambda loc: loc.level)
    return {
        "number": rack.number,
        "name": rack.name or f"TJR{rack.number}",
        "x": rack.x,
        "y": rack.y,
        "width": rack.width,
        "height": rack.height,
        "rotation": rack.rotation,
        "levels": [
            {"level": location.level, "standard_pallets": location.standard_pallets,
             "euro_pallets": location.euro_pallets,
             "utilization": round((location.standard_pallets / 2 + location.euro_pallets / 3) * 100, 2)}
            for location in locations
        ],
    }


def ensure_initial_data():
    # Evitar que la inicialización borre modificaciones posteriores.
    with transaction.atomic():
        StorageLayout.objects.get_or_create(pk=1)
        config = StorageLayout.objects.select_for_update().get(pk=1)
        if config.initial_racks_seeded:
            return
        existing = set(StorageRack.objects.values_list("number", flat=True))
        for number in range(1, 56):
            if number in existing:
                continue
            rack = StorageRack.objects.create(number=number)
            for level in range(1, 5):
                pct = OVERRIDES.get((number, level), 100)
                if pct == 50:
                    standard, euro = 1, 0
                elif pct == 67:
                    standard, euro = 0, 2
                elif pct == 33:
                    standard, euro = 0, 1
                elif pct == 0:
                    standard, euro = 0, 0
                else:
                    standard, euro = 0, 3
                StorageLocation.objects.create(
                    rack=rack, level=level,
                    standard_pallets=standard, euro_pallets=euro,
                )
        config.initial_racks_seeded = True
        config.save(update_fields=["initial_racks_seeded"])


class StorageUtilizationView(APIView):
    permission_classes = [IsAuthenticated, module_permission("warehouse")]

    def get(self, request):
        ensure_initial_data()
        config = StorageLayout.objects.get(pk=1)
        racks = StorageRack.objects.prefetch_related("locations").all()
        return Response({
            "designer_enabled": config.designer_enabled,
            "racks": [serialize_rack(rack) for rack in racks],
        })

    def patch(self, request):
        data = request.data
        from apps.permissions.services import PermissionService
        if not PermissionService.has_permission(request.user, "warehouse", "edit"):
            return Response({"detail": "Warehouse edit permission required."}, status=403)
        ensure_initial_data()
        if not isinstance(data, dict):
            return Response({"detail": "Expected an object."}, status=400)
        allowed = {"designer_enabled", "number", "levels", "x", "y", "width", "height", "rotation", "name", "level_count"}
        if set(data) - allowed:
            return Response({"detail": "Unsupported fields."}, status=400)

        if "designer_enabled" in data and type(data["designer_enabled"]) is not bool:
            return Response({"detail": "designer_enabled must be boolean."}, status=400)

        try:
            number = data.get("number")
            with transaction.atomic():
                if number is not None:
                    if type(number) is not int or not 1 <= number <= 32767:
                        return Response({"detail": "Invalid rack number."}, status=400)
                    rack = StorageRack.objects.select_for_update().get(number=number)
                    if "name" in data:
                        name = data["name"]
                        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
                            return Response({"detail": "Name must contain 1-80 characters."}, status=400)
                        if not location_name_available(name, exclude_number=rack.number):
                            return Response({"detail": "Location name already exists."}, status=400)
                        rack.name = name.strip()
                    if "level_count" in data:
                        count = data["level_count"]
                        if type(count) is not int or not 1 <= count <= 20:
                            return Response({"detail": "Level count must be between 1 and 20."}, status=400)
                        current_count = rack.locations.count()
                        if count < current_count and rack.locations.filter(level__gt=count).exclude(standard_pallets=0, euro_pallets=0).exists():
                            return Response({"detail": "Empty the higher levels before reducing their count."}, status=400)
                        rack.locations.filter(level__gt=count).delete()
                        for level in range(1, count + 1):
                            StorageLocation.objects.get_or_create(rack=rack, level=level)
                    if "pallet_type" in data:
                        return Response({"detail": "Pallet type is configured per location, not per rack."}, status=400)
                    if "levels" in data:
                        levels = data["levels"]
                        if not isinstance(levels, list) or len(levels) != rack.locations.count() or any(not isinstance(row, dict) for row in levels) or {row.get("level") for row in levels} != set(rack.locations.values_list("level", flat=True)):
                            return Response({"detail": "All existing levels are required."}, status=400)
                        for row in levels:
                            standard = row.get("standard_pallets")
                            euro = row.get("euro_pallets")
                            if type(standard) is not int or type(euro) is not int or standard < 0 or euro < 0 or standard * 3 + euro * 2 > 6:
                                return Response({"detail": "Mixed pallets exceed location capacity."}, status=400)
                    for name in ("x", "y", "width", "height"):
                        if name in data:
                            value = data[name]
                            if value is not None and (type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 100):
                                return Response({"detail": f"Invalid {name}."}, status=400)
                            if name in ("width", "height") and (value is None or value < 2):
                                return Response({"detail": f"{name} must be at least 2."}, status=400)
                            setattr(rack, name, value)
                    if rack.x is not None and rack.x + rack.width > 100 or rack.y is not None and rack.y + rack.height > 100:
                        return Response({"detail": "Rack must fit inside the warehouse canvas."}, status=400)
                    if "rotation" in data:
                        if type(data["rotation"]) is not int or data["rotation"] not in (0, 90, 180, 270):
                            return Response({"detail": "Invalid rotation."}, status=400)
                        rack.rotation = data["rotation"]
                    rack.save()
                    if "levels" in data:
                        for row in data["levels"]:
                            StorageLocation.objects.filter(rack=rack, level=row["level"]).update(standard_pallets=row["standard_pallets"], euro_pallets=row["euro_pallets"])
                else:
                    if any(field in data for field in ("levels", "x", "y", "width", "height", "rotation", "name", "level_count")):
                        return Response({"detail": "Rack number is required."}, status=400)
                if "designer_enabled" in data:
                    settings = StorageLayout.objects.select_for_update().get(pk=1)
                    settings.designer_enabled = data["designer_enabled"]
                    settings.save(update_fields=["designer_enabled", "updated_at"])
            return self.get(request)
        except StorageRack.DoesNotExist:
            return Response({"detail": "Rack not found."}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        from apps.permissions.services import PermissionService
        if not PermissionService.has_permission(request.user, "warehouse", "edit"):
            return Response({"detail": "Warehouse edit permission required."}, status=403)
        ensure_initial_data()
        data = request.data
        if not isinstance(data, dict) or set(data) != {"name", "level_count"}:
            return Response({"detail": "name and level_count required."}, status=400)
        name, count = data["name"], data["level_count"]
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
            return Response({"detail": "Invalid locality name."}, status=400)
        if type(count) is not int or not 1 <= count <= 20:
            return Response({"detail": "Level count must be between 1 and 20."}, status=400)
        with transaction.atomic():
            if not location_name_available(name):
                return Response({"detail": "Location name already exists."}, status=400)
            numbers = set(StorageRack.objects.values_list("number", flat=True))
            number = next((n for n in range(1, 32768) if n not in numbers), None)
            if number is None:
                return Response({"detail": "No free rack number."}, status=400)
            rack = StorageRack.objects.create(number=number, name=name.strip())
            StorageLocation.objects.bulk_create([
                StorageLocation(rack=rack, level=level) for level in range(1, count + 1)
            ])
        return self.get(request)

    def delete(self, request):
        from apps.permissions.services import PermissionService
        if not PermissionService.has_permission(request.user, "warehouse", "edit"):
            return Response({"detail": "Warehouse edit permission required."}, status=403)
        ensure_initial_data()
        try:
            number = int(request.query_params.get("number", ""))
        except (TypeError, ValueError):
            return Response({"detail": "Valid number required."}, status=400)
        with transaction.atomic():
            deleted, _ = StorageRack.objects.filter(number=number).delete()
            if not deleted:
                return Response({"detail": "Rack not found."}, status=404)
        return self.get(request)
