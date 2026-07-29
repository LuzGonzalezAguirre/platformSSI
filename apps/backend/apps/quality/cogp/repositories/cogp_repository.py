from decimal import Decimal
from datetime import date
from django.db import transaction
from django.db.models import Sum

from apps.quality.models import (
    CustomerPartMapping,
    ScrapRecord,
    ProductionRecord,
    COGPDailySummary,
    BusinessUnit,
    ClassificationSource,
)


class CogpRepository:
    """
    Capa de acceso a datos para el módulo COGP. Todas las queries a
    Postgres viven aquí -- el service layer nunca hace ORM queries
    directamente.
    """

    # ── CustomerPartMapping ─────────────────────────────────────────

    def get_business_unit_for_part(self, part_no: str) -> str:
        """
        Retorna el business_unit para un part_no dado, o SPEED si no
        hay mapping (parte de ingenieria/pruebas sin cliente asociado).
        """
        mapping = CustomerPartMapping.objects.filter(part_no=part_no).first()
        return mapping.business_unit if mapping else BusinessUnit.SPEED

    def get_all_part_to_bu_map(self) -> dict[str, str]:
        """
        Trae todo el mapping Part_No -> business_unit en un solo query,
        para usarse en memoria durante el sync (evita 1 query por fila
        de scrap/produccion).
        """
        return dict(
            CustomerPartMapping.objects.values_list("part_no", "business_unit")
        )

    @transaction.atomic
    def bulk_upsert_customer_part_mapping(self, rows: list[dict]) -> int:
        count = 0
        for row in rows:
            CustomerPartMapping.objects.update_or_create(
                part_no=row["part_no"],
                defaults={
                    "part_name": row.get("part_name", ""),
                    "part_status": row.get("part_status", ""),
                    "customer_no": row.get("customer_no"),
                    "customer_name": row.get("customer_name", ""),
                    "business_unit": row["business_unit"],
                    "classification_source": row["classification_source"],
                },
            )
            count += 1
        return count
    # ── ScrapRecord ──────────────────────────────────────────────────

    @transaction.atomic
    def bulk_upsert_scrap_records(self, rows: list[dict]) -> int:
        """
        rows: [{report_date, scrap_date, part_no, part_type, serial_no,
                quantity, weight, scrap_reason, workcenter,
                workcenter_group, department, unit_cost, extended_cost,
                note, business_unit}, ...]
        Reemplaza TODOS los registros de cada report_date presente en rows
        antes de insertar -- necesario porque la fuente (Plex via proxy)
        puede dejar de traer una fila que antes si traia (ej. cambio de
        filtro de workcenter), y un upsert puro dejaria filas fantasma
        que inflan las sumas (confirmado sesion 2026-07-28: extended_cost
        de VOLVO incluia una fila de HM Ensamble Frontal 2 ya descartada
        por el proxy pero nunca borrada de Postgres).
        """
        if not rows:
            return 0

        report_dates = {row["report_date"] for row in rows}
        ScrapRecord.objects.filter(report_date__in=report_dates).delete()

        objs = [
            ScrapRecord(
                report_date=row["report_date"],
                scrap_date=row["scrap_date"],
                part_no=row["part_no"],
                part_type=row.get("part_type", ""),
                serial_no=row["serial_no"],
                quantity=row["quantity"],
                weight=row.get("weight"),
                scrap_reason=row.get("scrap_reason", ""),
                workcenter=row.get("workcenter", ""),
                workcenter_group=row.get("workcenter_group", ""),
                department=row.get("department", ""),
                unit_cost=row.get("unit_cost"),
                extended_cost=row.get("extended_cost"),
                note=row.get("note", ""),
                business_unit=row["business_unit"],
            )
            for row in rows
        ]
        ScrapRecord.objects.bulk_create(objs)
        return len(objs)

    def get_scrap_cost_by_bu(self, start_date: date, end_date: date) -> dict[str, Decimal]:
        """
        end_date inclusive. Suma extended_cost agrupado por business_unit.
        """
        qs = (
            ScrapRecord.objects.filter(
                report_date__gte=start_date, report_date__lte=end_date
            )
            .values("business_unit")
            .annotate(total=Sum("extended_cost"))
        )
        return {row["business_unit"]: row["total"] or Decimal("0") for row in qs}

    # ── ProductionRecord ─────────────────────────────────────────────

    @transaction.atomic
    def bulk_upsert_production_records(self, rows: list[dict]) -> int:
        """
        rows: [{report_date, part_no, workcenter, quantity,
                extended_cost, cost_model_key, business_unit}, ...]
        Mismo criterio de reemplazo completo por report_date que
        bulk_upsert_scrap_records -- ver docstring ahi.
        """
        if not rows:
            return 0

        report_dates = {row["report_date"] for row in rows}
        ProductionRecord.objects.filter(report_date__in=report_dates).delete()

        objs = [
            ProductionRecord(
                report_date=row["report_date"],
                part_no=row["part_no"],
                workcenter=row.get("workcenter", ""),
                quantity=row["quantity"],
                extended_cost=row.get("extended_cost"),
                cost_model_key=row["cost_model_key"],
                business_unit=row["business_unit"],
            )
            for row in rows
        ]
        ProductionRecord.objects.bulk_create(objs)
        return len(objs)

    def get_extended_cost_by_bu(self, start_date: date, end_date: date) -> dict[str, Decimal]:
        qs = (
            ProductionRecord.objects.filter(
                report_date__gte=start_date, report_date__lte=end_date
            )
            .values("business_unit")
            .annotate(total=Sum("extended_cost"))
        )
        return {row["business_unit"]: row["total"] or Decimal("0") for row in qs}

    # ── COGPDailySummary ──────────────────────────────────────────────

    @transaction.atomic
    def upsert_daily_summary(
        self,
        report_date: date,
        business_unit: str,
        scrap_cost: Decimal,
        extended_cost: Decimal,
        cogp_pct: Decimal | None,
    ) -> None:
        COGPDailySummary.objects.update_or_create(
            report_date=report_date,
            business_unit=business_unit,
            defaults={
                "scrap_cost": scrap_cost,
                "extended_cost": extended_cost,
                "cogp_pct": cogp_pct,
            },
        )

    def get_summary_range(self, start_date: date, end_date: date):
        """
        Retorna queryset de COGPDailySummary para el rango, ordenado por
        business_unit. El service se encarga de agregar/formatear para
        el endpoint.
        """
        return COGPDailySummary.objects.filter(
            report_date__gte=start_date, report_date__lte=end_date
        ).order_by("business_unit", "report_date")

    def get_summary_totals_by_bu(self, start_date: date, end_date: date) -> dict:
        """
        Agrega scrap_cost y extended_cost sobre el rango completo,
        por business_unit, y recalcula cogp_pct sobre el total
        (no promedia los % diarios, que seria matematicamente incorrecto).
        """
        qs = (
            COGPDailySummary.objects.filter(
                report_date__gte=start_date, report_date__lte=end_date
            )
            .values("business_unit")
            .annotate(
                total_scrap_cost=Sum("scrap_cost"),
                total_extended_cost=Sum("extended_cost"),
            )
        )
        result = {}
        for row in qs:
            scrap = row["total_scrap_cost"] or Decimal("0")
            extended = row["total_extended_cost"] or Decimal("0")
            pct = (scrap / extended * 100) if extended > 0 else None
            result[row["business_unit"]] = {
                "scrap_cost": scrap,
                "extended_cost": extended,
                "cogp_pct": pct,
            }
        return result

    def get_weekly_summary(self, start_date: date, end_date: date) -> list[dict]:
        """
        Agrega COGPDailySummary por semana ISO 8601 (lunes-domingo) y
        business_unit. cogp_pct se recalcula sobre la suma semanal
        (scrap_cost/extended_cost), nunca promediando porcentajes diarios.
        Retorna lista ordenada por business_unit, iso_year, iso_week.
        """
        rows = COGPDailySummary.objects.filter(
            report_date__gte=start_date, report_date__lte=end_date
        ).values("report_date", "business_unit", "scrap_cost", "extended_cost")

        weekly: dict[tuple, dict] = {}
        for row in rows:
            iso_year, iso_week, _ = row["report_date"].isocalendar()
            key = (row["business_unit"], iso_year, iso_week)
            if key not in weekly:
                weekly[key] = {
                    "business_unit": row["business_unit"],
                    "iso_year": iso_year,
                    "iso_week": iso_week,
                    "scrap_cost": Decimal("0"),
                    "extended_cost": Decimal("0"),
                }
            weekly[key]["scrap_cost"] += row["scrap_cost"] or Decimal("0")
            weekly[key]["extended_cost"] += row["extended_cost"] or Decimal("0")

        result = []
        for data in weekly.values():
            extended = data["extended_cost"]
            data["cogp_pct"] = (
                (data["scrap_cost"] / extended * 100) if extended > 0 else None
            )
            result.append(data)

        result.sort(key=lambda r: (r["business_unit"], r["iso_year"], r["iso_week"]))
        return result