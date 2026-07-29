import logging
from datetime import date

from apps.quality.services.plex_client_quality import QualityPlexClient
from apps.quality.cogp.repositories.cogp_repository import CogpRepository
from apps.quality.models import BusinessUnit, ClassificationSource

logger = logging.getLogger(__name__)

# Mapeo Customer_No -> business_unit. Algunos clientes tienen multiples
# Customer_No (plantas/paises distintos bajo el mismo grupo) -- agrupados
# igual que MULTI_CUSTOMER en el proxy original (main.py).
CUSTOMER_NO_TO_BU = {
    332211: BusinessUnit.VOLVO,
    332165: BusinessUnit.CUMMINS,
    332170: BusinessUnit.CUMMINS,
    772808: BusinessUnit.JOHN_DEERE,
    780213: BusinessUnit.EATON,
    780215: BusinessUnit.EATON,
    781499: BusinessUnit.HARLEY_DAVIDSON,
    781500: BusinessUnit.HARLEY_DAVIDSON,
    781501: BusinessUnit.HARLEY_DAVIDSON,
    342070: BusinessUnit.TULC,   # Claas TULC+HM
    345523: BusinessUnit.TULC,   # Quanchai 12L TULC & HM
    342071: BusinessUnit.VOLVO,  # Volvo Eicher, India TULC
    345526: BusinessUnit.VOLVO,  # Volvo Truck, China - TULC & HM
}
# Fallback de clasificacion cuando Customer_No viene NULL en Plex (comun en
# componentes/subensambles que no llevan Customer_Part asignado formalmente,
# aunque el Part_Name si identifica la linea -- ej. "Volvo NA 10mm Tube..."
# con Customer_No=NULL, confirmado sesion 2026-07-28). Busqueda case-insensitive,
# el primer match gana -- entradas mas especificas van primero.
NAME_KEYWORD_TO_BU = [
    ("ELKHART", BusinessUnit.CUMMINS),
    ("CLAAS", BusinessUnit.TULC),
    ("QUANCHAI", BusinessUnit.TULC),
    ("JOHN DEERE", BusinessUnit.JOHN_DEERE),
    ("DEERE", BusinessUnit.JOHN_DEERE),
    ("HARLEY", BusinessUnit.HARLEY_DAVIDSON),
    ("EATON", BusinessUnit.EATON),
    ("CUMMINS", BusinessUnit.CUMMINS),
    ("VOLVO", BusinessUnit.VOLVO),
    ("TULC", BusinessUnit.TULC),
]


def resolve_bu_from_name(part_name: str) -> str | None:
    name_upper = (part_name or "").upper()
    for keyword, bu in NAME_KEYWORD_TO_BU:
        if keyword in name_upper:
            return bu
    return None

# Customer_No detectados en el catalogo que NO estan confirmados como
# parte de ninguna BU en scope de este proyecto -- se dejan fuera
# deliberadamente (caeran en SPEED) hasta confirmar con Luz:
# 342070 Claas TULC+HM, 342071 Volvo Eicher India TULC,
# 345523 Quanchai 12L TULC & HM, 345526 Volvo Truck China TULC & HM


class PlexSyncService:
    """
    Orquesta la sincronizacion diaria de scrap/produccion/mapping desde
    Plex hacia Postgres, via QualityPlexClient. No hace calculo de COGP
    (eso vive en CogpCalculationService) -- solo trae y persiste datos crudos.
    """

    def __init__(
        self,
        client: QualityPlexClient | None = None,
        repository: CogpRepository | None = None,
    ):
        self.client = client or QualityPlexClient()
        self.repository = repository or CogpRepository()

    def resolve_cost_model_key(self) -> int:
        """
        Resuelve el Cost_Model_Key primario vigente. Aborta el sync si
        no hay exactamente uno -- nunca asume un default.
        """
        result = self.client.get_cogp_cost_model()
        return result["cost_model_key"]

    def sync_customer_part_mapping(self) -> int:
        """
        Trae el catalogo completo Part_No -> Customer y lo clasifica por
        business_unit. Orden de resolucion: (1) Customer_No directo,
        (2) fallback por palabra clave en Part_Name, (3) SPEED sin
        clasificar. classification_source registra cual regla aplico,
        para poder auditar en la tabla de mapping del frontend.
        """
        raw_rows = self.client.get_cogp_customer_part_mapping()
        upsert_rows = []

        for row in raw_rows:
            customer_no = row.get("Customer_No")
            business_unit = CUSTOMER_NO_TO_BU.get(customer_no)
            source = ClassificationSource.CUSTOMER_NO

            if business_unit is None:
                business_unit = resolve_bu_from_name(row.get("Part_Name"))
                source = ClassificationSource.NAME_FALLBACK
                if business_unit is not None:
                    logger.info(
                        "Part_No=%s clasificado por nombre (%s) -> %s "
                        "(Customer_No era %s)",
                        row["Part_No"], row.get("Part_Name"), business_unit, customer_no,
                    )

            if business_unit is None:
                business_unit = BusinessUnit.SPEED
                source = ClassificationSource.UNMAPPED

            upsert_rows.append({
                "part_no": row["Part_No"],
                "part_name": row.get("Part_Name") or "",
                "part_status": row.get("Part_Status") or "",
                "customer_no": customer_no,
                "customer_name": row.get("Customer_Name") or "",
                "business_unit": business_unit,
                "classification_source": source,
            })

        count = self.repository.bulk_upsert_customer_part_mapping(upsert_rows)
        logger.info("CustomerPartMapping sync: %s partes procesadas", count)
        return count
    
    def sync_scrap_for_date(self, report_date: date, part_to_bu: dict[str, str]) -> int:
        raw_rows = self.client.get_cogp_scrap_by_date(report_date.isoformat())
        upsert_rows = []

        for row in raw_rows:
            part_no = row["Part_No"]
            business_unit = part_to_bu.get(part_no, BusinessUnit.SPEED)

            upsert_rows.append({
                "report_date": report_date,
                "scrap_date": row["Time_Scrapped"],
                "part_no": part_no,
                "part_type": row.get("Part_Type") or "",
                "serial_no": row.get("Serial_No") or "",
                "quantity": row["Quantity"],
                "weight": row.get("Weight"),
                "scrap_reason": row.get("Scrap_Reason") or "",
                "workcenter": row.get("Workcenter") or "",
                "workcenter_group": row.get("Workcenter_Group") or "",
                "department": row.get("Department") or "",
                "unit_cost": row.get("Unit_Cost"),
                "extended_cost": row.get("Extended_Cost"),
                "note": row.get("Note") or "",
                "business_unit": business_unit,
            })

        count = self.repository.bulk_upsert_scrap_records(upsert_rows)
        logger.info("ScrapRecord sync %s: %s registros", report_date, count)
        return count

    def sync_production_for_date(
        self, report_date: date, cost_model_key: int, part_to_bu: dict[str, str]
    ) -> int:
        raw_rows = self.client.get_cogp_production_by_date(
            report_date.isoformat(), cost_model_key
        )
        upsert_rows = []

        for row in raw_rows:
            part_no = row["Part_No"]
            business_unit = part_to_bu.get(part_no, BusinessUnit.SPEED)

            if business_unit == BusinessUnit.SPEED:
                logger.warning(
                    "Produccion con business_unit=SPEED (Part_No=%s, "
                    "report_date=%s) -- no deberia haber produccion "
                    "facturable sin cliente mapeado. Revisar CustomerPartMapping.",
                    part_no, report_date,
                )

            upsert_rows.append({
                "report_date": report_date,
                "part_no": part_no,
                "workcenter": row.get("Workcenter") or "",
                "quantity": row["Quantity"],
                "extended_cost": row.get("Extended_Cost"),
                "cost_model_key": cost_model_key,
                "business_unit": business_unit,
            })

        count = self.repository.bulk_upsert_production_records(upsert_rows)
        logger.info("ProductionRecord sync %s: %s registros", report_date, count)
        return count

    def sync_all_for_date(self, report_date: date) -> dict:
        """
        Orquesta el sync completo para un report_date: mapping (si esta
        stale), cost model, scrap, produccion. Retorna conteos para logging.
        """
        cost_model_key = self.resolve_cost_model_key()

        # El mapping podria refrescarse solo si stale > 24h en produccion
        # (ver tasks.py), pero para sync manual/on-demand siempre se refresca.
        self.sync_customer_part_mapping()
        part_to_bu = self.repository.get_all_part_to_bu_map()

        scrap_count = self.sync_scrap_for_date(report_date, part_to_bu)
        production_count = self.sync_production_for_date(
            report_date, cost_model_key, part_to_bu
        )

        return {
            "report_date": report_date,
            "cost_model_key": cost_model_key,
            "scrap_records": scrap_count,
            "production_records": production_count,
        }