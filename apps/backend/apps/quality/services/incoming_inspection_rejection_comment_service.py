# apps/quality/services/incoming_inspection_rejection_comment_service.py
from apps.quality.models import IncomingRejectionComment


def list_comments(serial_no: str):
    return IncomingRejectionComment.objects.filter(serial_no=serial_no)


def create_comment(serial_no: str, user, comment_text: str) -> IncomingRejectionComment:
    text = (comment_text or "").strip()
    if not text:
        raise ValueError("El comentario no puede estar vacío.")
    return IncomingRejectionComment.objects.create(
        serial_no=serial_no,
        comment=text,
        created_by=user,
    )