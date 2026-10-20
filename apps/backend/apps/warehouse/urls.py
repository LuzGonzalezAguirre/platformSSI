from django.urls import path
from apps.warehouse.views.shelf_life import ShelfLifeView
from apps.warehouse.views.delivery_performance import DeliveryPerformanceView
from apps.warehouse.views.delivery_actions import DeliveryActionsView, DeliveryActionDetailView
from apps.warehouse.views.storage_utilization import StorageUtilizationView
from apps.warehouse.views.warehouse_view import (
    PartRevisionsView,
    BomHierarchyView,
    BomCtbView,
    DemandView,
)

urlpatterns = [
    path("delivery-performance/", DeliveryPerformanceView.as_view(), name="warehouse-delivery-performance"),
    path("delivery-performance/actions/", DeliveryActionsView.as_view(), name="warehouse-delivery-actions"),
    path("delivery-performance/actions/<int:pk>/", DeliveryActionDetailView.as_view(), name="warehouse-delivery-action-detail"),
    path("shelf-life/", ShelfLifeView.as_view(), name="warehouse-shelf-life"),
    path("storage-utilization/", StorageUtilizationView.as_view(), name="storage-utilization"),
    path("parts/<str:part_no>/revisions/",              PartRevisionsView.as_view(), name="part-revisions"),
    path("parts/<str:part_no>/bom/<str:revision>/",     BomHierarchyView.as_view(),  name="bom-hierarchy"),
    path("parts/<str:part_no>/ctb/<str:revision>/",     BomCtbView.as_view(),        name="bom-ctb"),
    path("demand/",                                      DemandView.as_view(),        name="demand"),
]