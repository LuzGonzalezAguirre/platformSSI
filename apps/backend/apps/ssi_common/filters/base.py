"""
Contrato base de filtros compartido por production, quality y maintenance.

Cada módulo extiende BaseRangeFilterSerializer agregando SOLO los campos
que le son propios (ej. `status` en quality), nunca redefiniendo
start_date/end_date/bu/workcenter/shift.
"""
from dataclasses import dataclass
from datetime import date

from rest_framework import serializers

from apps.ssi_common.filters.choices import BU_CHOICES
from apps.ssi_common.filters.shift_calendar import ALL_SHIFTS


class BaseRangeFilterSerializer(serializers.Serializer):
    start_date = serializers.DateField(required=True)
    end_date = serializers.DateField(required=True)
    bu = serializers.MultipleChoiceField(choices=BU_CHOICES, required=False)
    workcenter = serializers.ListField(
        child=serializers.CharField(max_length=64), required=False, default=list
    )
    shift = serializers.MultipleChoiceField(
        choices=tuple((s, s) for s in ALL_SHIFTS), required=False
    )

    MAX_RANGE_DAYS = 366  # límite duro de sanidad; el chunking interno (168d) maneja rangos largos

    def validate(self, attrs):
        start = attrs["start_date"]
        end = attrs["end_date"]

        if start > end:
            raise serializers.ValidationError(
                {"end_date": "end_date debe ser mayor o igual a start_date."}
            )

        if (end - start).days > self.MAX_RANGE_DAYS:
            raise serializers.ValidationError(
                {"end_date": f"El rango máximo permitido es {self.MAX_RANGE_DAYS} días."}
            )

        return attrs

    def to_filter_context(self) -> "FilterContext":
        """
        Convierte datos ya validados en un FilterContext inmutable.
        Este es el único objeto que la capa Service debe recibir —
        nunca pasar request.query_params directamente a un Service.
        """
        data = self.validated_data
        return FilterContext(
            start_date=data["start_date"],
            end_date=data["end_date"],
            bu=tuple(sorted(data.get("bu", ()))),
            workcenter=tuple(sorted(data.get("workcenter", ()))),
            shift=tuple(sorted(data.get("shift", ()))),
        )


@dataclass(frozen=True)
class FilterContext:
    """
    Objeto de transferencia inmutable entre View y Service.

    Inmutable a propósito: un Service nunca debe mutar el filtro que
    recibió, para que la cache key calculada al inicio del request
    siga siendo válida durante todo el ciclo de vida del request.
    """
    start_date: date
    end_date: date
    bu: tuple[str, ...] = ()
    workcenter: tuple[str, ...] = ()
    shift: tuple[str, ...] = ()

    def cache_key(self, prefix: str) -> str:
        parts = [
            prefix,
            self.start_date.isoformat(),
            self.end_date.isoformat(),
            ",".join(self.bu),
            ",".join(self.workcenter),
            ",".join(self.shift),
        ]
        return ":".join(p for p in parts if p)

    def restricted_to_bu(self, allowed_bu: tuple[str, ...]) -> "FilterContext":
        """
        Si el usuario no mandó `bu` explícito, se interpreta como "todo
        lo que su rol permite" (allowed_bu), NO como "sin filtro" —
        evita que un query sin filtro explícito se salte el scoping.
        """
        if not self.bu:
            effective_bu = allowed_bu
        else:
            effective_bu = tuple(sorted(set(self.bu) & set(allowed_bu)))

        return FilterContext(
            start_date=self.start_date,
            end_date=self.end_date,
            bu=effective_bu,
            workcenter=self.workcenter,
            shift=self.shift,
        )