from datetime import date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.permissions.drf import module_permission
from apps.permissions.services import PermissionService
from apps.warehouse.models import DeliveryAction


FIELDS = ("chart", "period_key", "customer", "reason", "task", "responsible", "start_date", "due_date", "status")
CHARTS = {"monthlyCustomers", "weeklyCustomers", "weeklyTrend", "monthlyTrend"}
STATUSES = {"Pending", "In Progress", "Completed", "Cancelled"}


def payload(action):
    return {"id": action.pk, **{
        field: getattr(action, field).isoformat() if isinstance(getattr(action, field), date) else getattr(action, field)
        for field in FIELDS
    }}


class DeliveryActionsView(APIView):
    permission_classes = [IsAuthenticated, module_permission("warehouse")]

    def get(self, request):
        rows = DeliveryAction.objects.all().order_by("-created_at")
        return Response([payload(action) for action in rows])

    def post(self, request):
        if not PermissionService.has_permission(request.user, "warehouse", "edit"):
            return Response({"detail": "Warehouse edit permission required"}, status=403)
        data = request.data
        if not isinstance(data, dict) or set(data) - set(FIELDS):
            return Response({"detail": "Invalid fields"}, status=400)
        if data.get("chart") not in CHARTS:
            return Response({"detail": "Invalid chart"}, status=400)
        customer = str(data.get("customer", "")).strip()
        if data["chart"].endswith("Customers") and not customer:
            return Response({"detail": "Customer required"}, status=400)
        period_key = str(data.get("period_key", "")).strip()
        if len(period_key) < 7 or len(period_key) > 16:
            return Response({"detail": "Invalid period key"}, status=400)
        if data.get("status", "Pending") not in STATUSES:
            return Response({"detail": "Invalid status"}, status=400)
        values = {}
        for field in ("reason", "task", "responsible"):
            value = data.get(field)
            if not isinstance(value, str) or not value.strip() or len(value) > (160 if field == "responsible" else 4000):
                return Response({"detail": f"Invalid {field}"}, status=400)
            values[field] = value.strip()
        try:
            start = date.fromisoformat(data["start_date"])
            due = date.fromisoformat(data["due_date"])
        except (ValueError, TypeError, KeyError):
            return Response({"detail": "Invalid dates"}, status=400)
        if due < start:
            return Response({"detail": "Due date must not precede start date"}, status=400)
        action = DeliveryAction.objects.create(
            chart=data["chart"], period_key=period_key,
            customer=customer, start_date=start, due_date=due,
            status=data.get("status", "Pending"), **values,
        )
        return Response(payload(action), status=201)


class DeliveryActionDetailView(APIView):
    permission_classes = [IsAuthenticated, module_permission("warehouse")]

    def patch(self, request, pk):
        if not PermissionService.has_permission(request.user, "warehouse", "edit"):
            return Response({"detail": "Warehouse edit permission required"}, status=403)
        action = DeliveryAction.objects.filter(pk=pk).first()
        if action is None:
            return Response({"detail": "Not found"}, status=404)
        if not isinstance(request.data, dict) or not request.data or set(request.data) - set(FIELDS):
            return Response({"detail": "Invalid fields"}, status=400)
        for field, value in request.data.items():
            if field == "chart" and value not in CHARTS:
                return Response({"detail": "Invalid chart"}, status=400)
            if field == "status" and value not in STATUSES:
                return Response({"detail": "Invalid status"}, status=400)
            if field in ("start_date", "due_date"):
                try:
                    value = date.fromisoformat(value)
                except (ValueError, TypeError):
                    return Response({"detail": "Invalid date"}, status=400)
            if field in ("reason", "task", "responsible") and (
                not isinstance(value, str) or not value.strip() or len(value) > (160 if field == "responsible" else 4000)
            ):
                return Response({"detail": f"Invalid {field}"}, status=400)
            setattr(action, field, value)
        if action.chart.endswith("Customers") and not action.customer.strip():
            return Response({"detail": "Customer required"}, status=400)
        if action.status not in STATUSES or action.due_date < action.start_date or not 7 <= len(action.period_key) <= 16:
            return Response({"detail": "Invalid action values"}, status=400)
        action.save()
        return Response(payload(action))

    def delete(self, request, pk):
        if not PermissionService.has_permission(request.user, "warehouse", "edit"):
            return Response({"detail": "Warehouse edit permission required"}, status=403)
        removed, _ = DeliveryAction.objects.filter(pk=pk).delete()
        return Response(status=204 if removed else 404)
