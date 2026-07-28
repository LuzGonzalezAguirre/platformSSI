# apps/quality/services/rejection_service.py

from ..repositories.rejection_repository import RejectionRepository
from .fail_mode_translation_service import FailModeTranslationService

import re

def _is_test_wo(work_order) -> bool:
    if work_order is None:
        return True
    wo = str(work_order).strip()
    if not wo or wo == "0":
        return True
    if re.fullmatch(r"0+", wo):
        return True
    if re.fullmatch(r"[Pp]0+", wo):
        return True
    return False


class RejectionService:

    def __init__(self):
        self._repo = RejectionRepository()

    def get_tree(
        self,
        start: str,
        end: str,
        bu_id: int | None,
        include_test: bool = False,
        locale: str = "es",
    ) -> list[dict]:
        rows = self._repo.get_rejection_report(start, end, bu_id)

        # Filtrar producción vs pruebas
        if include_test:
            rows = [r for r in rows if _is_test_wo(r.get("workOrder"))]
        else:
            rows = [r for r in rows if not _is_test_wo(r.get("workOrder"))]

        # Traducciones de fail mode: UNA sola consulta a Postgres (no loop).
        # CCS solo tiene la descripción en español; para locale != "es" se
        # sobrescribe con la traducción si existe, con fallback al original.
        translations = (
            FailModeTranslationService.get_translations_map(locale)
            if locale != "es"
            else {}
        )

        # Estructura: fail_mode → serial_number → inspections[]
        tree: dict[int, dict] = {}

        for r in rows:
            fm_id = r["fail_mode_id"]
            sn    = r["serial_number"] or r["frameSN"] or f"WO-{r['workOrder']}"

            if fm_id not in tree:
                fail_code  = r["fail_code"]
                translated = translations.get(fail_code)
                tree[fm_id] = {
                    "fail_mode_id":     fm_id,
                    "fail_code":        fail_code,
                    "fail_description": translated or r["fail_description"],
                    "has_translation":  translated is not None,
                    "count":            0,
                    "serials":          {},
                }

            fm_node = tree[fm_id]

            if sn not in fm_node["serials"]:
                fm_node["serials"][sn] = {
                    "serial_number": sn,
                    "frame_sn":      r["frameSN"],
                    "fpca_sn":       r["fpcaSN"],
                    "inspections":   [],
                }

            fm_node["serials"][sn]["inspections"].append({
                "result_id":      r["result_id"],
                "inspection_id":  r["inspection_id"],
                "point_name":     r["point_name"],
                "bu_name":        r["bu_name"],
                "inspector_name": r["inspector_name"],
                "started_at":     r["started_at"],
                "work_order":     r["workOrder"],
                "has_photo":      bool(r["has_photo"]),
            })

            fm_node["count"] += 1

        result = []
        for fm_node in sorted(tree.values(), key=lambda x: -x["count"]):
            serials_list = list(fm_node["serials"].values())
            fm_node["serials"] = serials_list
            result.append(fm_node)

        return result

    def get_photo(self, inspection_id: int) -> dict:
        return self._repo.get_rejection_photo(inspection_id)