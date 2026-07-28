# apps/quality/services/failure_catalog_service.py
from datetime import date, timedelta
from django.core.cache import cache
from ..repositories.qwall_repository import QWallRepository
from ..models.failure_catalog import FailureModeImage
from apps.ssi_common.db import proxy_get
from .fail_mode_translation_service import FailModeTranslationService

CACHE_TTL = 1800  # 30 min


class FailureCatalogService:

    @staticmethod
    def get_catalog(days: int = 180) -> list[dict]:
        """
        Devuelve la lista de puntos de inspección con sus modos de falla,
        derivados del historial de inspecciones del qwall proxy.
        Cada modo de falla incluye la imagen almacenada en Postgres (si existe).
        """
        cache_key = f"failure_catalog:points:{days}"
        cached_points = cache.get(cache_key)

        if cached_points is None:
            end_date   = date.today()
            start_date = end_date - timedelta(days=days)
            rows       = QWallRepository.get_inspections(start_date, end_date)
            cached_points = FailureCatalogService._extract_points(rows)
            cache.set(cache_key, cached_points, CACHE_TTL)

        images = {
            (img.inspection_point, img.failure_mode): img
            for img in FailureModeImage.objects.select_related('updated_by').all()
        }

        result = []
        for point_name, fail_modes in cached_points.items():
            modes_out = []
            for fm in sorted(fail_modes):
                img = images.get((point_name, fm))
                modes_out.append({
                    "name":       fm,
                    "has_image":  img is not None and bool(img.image_data),
                    "image_data": img.image_data  if img else "",
                    "image_mime": img.image_mime  if img else "",
                    "updated_at": img.updated_at.isoformat() if img else None,
                    "updated_by": (
                        img.updated_by.get_full_name() or img.updated_by.username
                        if img and img.updated_by else None
                    ),
                })
            result.append({
                "name":          point_name,
                "failure_modes": modes_out,
            })

        result.sort(key=lambda x: x["name"])
        return result

    @staticmethod
    def _extract_points(rows: list[dict]) -> dict[str, set]:
        points: dict[str, set] = {}
        for row in rows:
            ip = (row.get("inspection_type") or "").strip()
            if not ip:
                continue
            if ip not in points:
                points[ip] = set()
            if row.get("result") == "FAIL" and row.get("fail_modes"):
                for fm in row["fail_modes"].split(","):
                    fm = fm.strip()
                    if fm:
                        points[ip].add(fm)
        return points

    @staticmethod
    def get_structure(locale: str = "es") -> list[dict]:
        """
        Devuelve la jerarquía completa desde SQL Server (via proxy):
          BusinessUnit → InspectionPoints → FailModes
        Cada modo de falla incluye la imagen guardada en Postgres (si existe)
        y, si locale != "es", su traducción (con fallback al español).
        """
        resp = proxy_get("/catalog/structure")
        rows = resp.get("data", [])

        # Imágenes de Postgres — clave: (point_name, fail_code)
        images = {
            (img.inspection_point, img.failure_mode): img
            for img in FailureModeImage.objects.select_related('updated_by').all()
        }

        # Traducciones de fail mode: UNA sola consulta a Postgres (no loop).
        translations = (
            FailModeTranslationService.get_translations_map(locale)
            if locale != "es"
            else {}
        )

        # Construir jerarquía desde las filas planas
        bu_map: dict[int, dict] = {}
        for row in rows:
            bu_id   = row["bu_id"]
            bu_name = row["bu_name"]
            ip_id   = row.get("inspection_point_id")
            ip_name = row.get("point_name") or ""
            fm_id   = row.get("fail_mode_id")
            fm_code = row.get("fail_code") or ""
            fm_desc_original = row.get("fm_description") or fm_code
            fm_desc = translations.get(fm_code, fm_desc_original)

            if bu_id not in bu_map:
                bu_map[bu_id] = {
                    "id":                bu_id,
                    "name":              bu_name,
                    "inspection_points": {},
                }

            if not ip_id:
                continue

            ip_map = bu_map[bu_id]["inspection_points"]
            if ip_id not in ip_map:
                ip_map[ip_id] = {
                    "id":         ip_id,
                    "name":       ip_name,
                    "fail_modes": [],
                }

            if not fm_id:
                continue

            img = images.get((ip_name, fm_code))
            ip_map[ip_id]["fail_modes"].append({
                "id":               fm_id,
                "name":             fm_desc,
                "fail_code":        fm_code,
                "has_translation":  fm_code in translations,
                "has_image":        img is not None and bool(img.image_data),
                "image_data":       img.image_data  if img else "",
                "image_mime":       img.image_mime  if img else "",
                "updated_at":       img.updated_at.isoformat() if img else None,
                "updated_by": (
                    img.updated_by.get_full_name() or img.updated_by.username
                    if img and img.updated_by else None
                ),
            })

        result = []
        for bu_data in bu_map.values():
            ips = list(bu_data["inspection_points"].values())
            result.append({
                "id":                bu_data["id"],
                "name":              bu_data["name"],
                "inspection_points": ips,
            })

        return result
    @staticmethod
    def save_image(inspection_point: str, failure_mode: str,
                   image_data: str, image_mime: str, user) -> FailureModeImage:
        obj, _ = FailureModeImage.objects.update_or_create(
            inspection_point=inspection_point,
            failure_mode=failure_mode,
            defaults={
                "image_data": image_data,
                "image_mime": image_mime,
                "updated_by": user,
            },
        )
        return obj

    @staticmethod
    def delete_image(inspection_point: str, failure_mode: str) -> bool:
        deleted, _ = FailureModeImage.objects.filter(
            inspection_point=inspection_point,
            failure_mode=failure_mode,
        ).delete()
        return deleted > 0
