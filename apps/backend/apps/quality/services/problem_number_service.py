# apps/quality/services/problem_number_service.py
from datetime import datetime
from apps.quality.repositories.problem_repository import ProblemRepository


class ProblemNumberService:
    """
    Service para generación de Problem Numbers.
    Formato: CA-WW-YY-XXXXX
    
    CA = Corrective Action (fijo)
    WW = Semana del año (01-52)
    YY = Año (últimos 2 dígitos)
    XXXXX = Secuencial global (00001, 00002, ...)
    """

    @staticmethod
    def generate_problem_number() -> str:
        """
        Generar nuevo problem number con formato CA-WW-YY-XXXXX.
        Thread-safe.
        """
        now = datetime.now()
        
        # CA (fijo)
        prefix = "CA"
        
        # WW (semana del año)
        week = now.isocalendar()[1]
        week_str = f"{week:02d}"
        
        # YY (año)
        year_str = f"{now.year % 100:02d}"
        
        # XXXXX (secuencial global)
        sequential = ProblemRepository.get_next_sequential_number()
        seq_str = f"{sequential:05d}"
        
        return f"{prefix}-{week_str}-{year_str}-{seq_str}"