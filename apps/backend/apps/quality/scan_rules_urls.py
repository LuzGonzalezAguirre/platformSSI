from django.urls import path
from apps.permissions.drf import quality_view
from apps.quality.views.scan_rules_views import (
    ScanRuleListCreateView,
    ScanRuleDetailView,
    ScanRuleToggleView,
    PartNumberLookupView,
)

urlpatterns = [
    path("",                  quality_view(ScanRuleListCreateView)),
    path("pn-lookup/",        quality_view(PartNumberLookupView)),
    path("<int:pk>/",         quality_view(ScanRuleDetailView)),
    path("<int:pk>/toggle/",  quality_view(ScanRuleToggleView)),
]
