from django.db import transaction
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
# Las ubicaciones de 50% requieren pallet estándar para representar la fuente.
STANDARD_RACKS = {22, 31, 45, 47, 54}


def capacity(rack):
    return 2 if rack.pallet_type == StorageRack.STANDARD else 3


def serialize_rack(rack):
    cap = capacity(rack)
    locations = sorted(rack.locations.all(), key=lambda loc: loc.level)
    return {
        "number": rack.number,
        "pallet_type": rack.pallet_type,
        "x": rack.x,
        "y": rack.y,
        "width": rack.width,
        "height": rack.height,
        "rotation": rack.rotation,
        "levels": [
            {"level": location.level, "pallet_count": location.pallet_count,
             "utilization": round(location.pallet_count * 100 / cap, 2)}
            for location in locations
        ],
    }


def ensure_initial_data():
    # Evitar que la inicialización borre modificaciones posteriores.
    with transaction.atomic():
        StorageLayout.objects.get_or_create(pk=1)
        existing = set(StorageRack.objects.values_list("number", flat=True))
        for number in range(1, 56):
            if number in existing:
                continue
            rack = StorageRack.objects.create(
                number=number,
                pallet_type=StorageRack.STANDARD if number in STANDARD_RACKS else StorageRack.EURO,
            )
            cap = capacity(rack)
            for level in range(1, 5):
                pct = OVERRIDES.get((number, level), 100)
                count = round(pct * cap / 100)
                StorageLocation.objects.create(rack=rack, level=level, pallet_count=count)


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
        ensure_initial_data()
        data = request.data
        if not isinstance(data, dict):
            return Response({"detail": "Expected an object."}, status=400)
        allowed = {"designer_enabled", "number", "pallet_type", "levels", "x", "y", "width", "height", "rotation"}
        if set(data) - allowed:
            return Response({"detail": "Unsupported fields."}, status=400)

        if "designer_enabled" in data and type(data["designer_enabled"]) is not bool:
            return Response({"detail": "designer_enabled must be boolean."}, status=400)

        try:
            number = data.get("number")
            with transaction.atomic():
                if number is not None:
                    if type(number) is not int or not 1 <= number <= 55:
                        return Response({"detail": "Invalid rack number."}, status=400)
                    rack = StorageRack.objects.select_for_update().get(number=number)
                    pallet_type = data.get("pallet_type", rack.pallet_type)
                    if pallet_type not in ("euro", "standard"):
                        return Response({"detail": "Invalid pallet type."}, status=400)
                    cap = 2 if pallet_type == "standard" else 3
                    if "levels" in data:
                        levels = data["levels"]
                        if not isinstance(levels, list) or len(levels) != 4 or {row.get("level") for row in levels if isinstance(row, dict)} != {1, 2, 3, 4}:
                            return Response({"detail": "Four unique levels (1-4) are required."}, status=400)
                        if any(type(row.get("pallet_count")) is not int or not 0 <= row["pallet_count"] <= cap for row in levels):
                            return Response({"detail": "Invalid pallet count."}, status=400)
                    elif pallet_type != rack.pallet_type and rack.locations.filter(pallet_count__gt=cap).exists():
                        return Response({"detail": "Reduce pallet counts before changing pallet type."}, status=400)
                    for name in ("x", "y", "width", "height"):
                        if name in data:
                            value = data[name]
                            if value is not None and (type(value) not in (int, float) or not 0 <= value <= 100):
                                return Response({"detail": f"Invalid {name}."}, status=400)
                            if name in ("width", "height") and (value is None or value < 2):
                                return Response({"detail": f"{name} must be at least 2."}, status=400)
                            setattr(rack, name, value)
                    if "rotation" in data:
                        if type(data["rotation"]) is not int or data["rotation"] not in (0, 90, 180, 270):
                            return Response({"detail": "Invalid rotation."}, status=400)
                        rack.rotation = data["rotation"]
                    rack.pallet_type = pallet_type
                    rack.save()
                    if "levels" in data:
                        for row in data["levels"]:
                            StorageLocation.objects.filter(rack=rack, level=row["level"]).update(pallet_count=row["pallet_count"])
                else:
                    if any(field in data for field in ("pallet_type", "levels", "x", "y", "width", "height", "rotation")):
                        return Response({"detail": "Rack number is required."}, status=400)
                if "designer_enabled" in data:
                    settings = StorageLayout.objects.select_for_update().get(pk=1)
                    settings.designer_enabled = data["designer_enabled"]
                    settings.save(update_fields=["designer_enabled", "updated_at"])
            return self.get(request)
        except StorageRack.DoesNotExist:
            return Response({"detail": "Rack not found."}, status=status.HTTP_404_NOT_FOUND)
