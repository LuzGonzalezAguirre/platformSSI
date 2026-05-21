# apps/quality/services/sla_service.py
from datetime import datetime, timedelta
from apps.quality.repositories.problem_repository import ProblemRepository


class SLAService:
    """
    Service para cálculo de SLA considerando días hábiles.
    Holidays configurables vía modelo Holiday.
    """

    @staticmethod
    def calculate_due_date(
        start_date: datetime,
        days: int,
        timezone_str: str = "America/Tijuana"
    ) -> datetime:
        """
        Calcular fecha de vencimiento excluyendo holidays.
        
        Args:
            start_date: Fecha inicial
            days: Días calendario a agregar
            timezone_str: Timezone de la planta
            
        Returns:
            datetime de vencimiento
        """
        from django.utils import timezone as tz
        import pytz

        # Convertir a timezone de la planta
        plant_tz = pytz.timezone(timezone_str)
        if start_date.tzinfo is None:
            start_date = plant_tz.localize(start_date)
        else:
            start_date = start_date.astimezone(plant_tz)

        # Obtener holidays del año
        year = start_date.year
        holidays = ProblemRepository.get_holidays(year)
        holiday_dates = {h.date for h in holidays}

        current_date = start_date
        days_added = 0

        while days_added < days:
            current_date += timedelta(days=1)
            # Solo contar si NO es holiday
            if current_date.date() not in holiday_dates:
                days_added += 1

        return current_date

    @staticmethod
    def calculate_initial_response_due(created_at: datetime, hours: int = 48) -> datetime:
        """
        Calcular vencimiento de Initial Response (D3).
        Por defecto 48 horas desde creación.
        """
        return created_at + timedelta(hours=hours)

    @staticmethod
    def is_overdue(due_date: datetime) -> bool:
        """Check if due date has passed"""
        from django.utils import timezone
        return timezone.now() > due_date if due_date else False

    @staticmethod
    def days_until_due(due_date: datetime) -> int:
        """Calculate days until due (negative if overdue)"""
        from django.utils import timezone
        if not due_date:
            return 0
        delta = due_date - timezone.now()
        return delta.days