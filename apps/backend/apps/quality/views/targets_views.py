# apps/quality/views/targets_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.quality.models import QualityTarget
from apps.quality.serializers import QualityTargetSerializer


class QualityTargetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        targets = QualityTarget.objects.all().order_by(
            "level", "bu", "workcenter_name"
        )
        return Response(QualityTargetSerializer(targets, many=True).data)

    def post(self, request):
        serializer = QualityTargetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save(updated_by=request.user)
        return Response(serializer.data, status=201)

    def put(self, request, pk: int):
        try:
            target = QualityTarget.objects.get(pk=pk)
        except QualityTarget.DoesNotExist:
            return Response({"detail": "No encontrado."}, status=404)

        serializer = QualityTargetSerializer(target, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)