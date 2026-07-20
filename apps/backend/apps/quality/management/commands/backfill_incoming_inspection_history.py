# apps/quality/management/commands/backfill_incoming_inspection_history.py
"""
Backfill único de IncomingContainerHistory desde una fecha fija — separado
del sync incremental normal (sync_incoming_history en tasks.py), que solo
trae cambios desde el último watermark y por diseño nunca trae histórico
completo en su primera corrida.

Uso:
    docker compose exec backend python manage.py backfill_incoming_inspection_history
    docker compose exec backend python manage.py backfill_incoming_inspection_history --since 2026-01-01
"""
from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.quality.models import IncomingInspectionSyncState
from apps.quality.repositories import incoming_inspection_plex_repository as plex_repo
from apps.quality.tasks import upsert_history_rows

DEFAULT_SINCE = "2026-01-01 00:00:00"


class Command(BaseCommand):
    help = "Backfill único de IncomingContainerHistory desde una fecha fija (default 2026-01-01)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--since",
            default=DEFAULT_SINCE,
            help="Fecha/hora de arranque del backfill, formato 'YYYY-MM-DD HH:MM:SS' (default: %(default)s).",
        )

    def handle(self, *args, **options):
        since = datetime.strptime(options["since"], "%Y-%m-%d %H:%M:%S")
        run_started_at = timezone.now()

        self.stdout.write(f"Backfilling Incoming Inspection history desde {since}...")

        rows = plex_repo.fetch_history_since(since)
        self.stdout.write(f"Plex devolvió {len(rows)} filas.")

        created, existing = upsert_history_rows(rows)

        IncomingInspectionSyncState.objects.update_or_create(
            sync_type="history",
            defaults={
                "last_synced_at": run_started_at,
                "last_run_status": "ok",
                "last_error_message": None,
            },
        )

        self.stdout.write(self.style.SUCCESS(
            f"Backfill completo — Plex: {len(rows)} filas | "
            f"insertadas: {created} | ya existían (dedupe): {existing} | "
            f"watermark actualizado a {run_started_at.isoformat()}"
        ))
