from django.urls import path
from apps.quality.views.scan_rules_views import (
    ScanRuleListCreateView,
    ScanRuleDetailView,
    ScanRuleToggleView,
    PartNumberLookupView,
)

urlpatterns = [
    path("",                  ScanRuleListCreateView.as_view()),
    path("pn-lookup/",        PartNumberLookupView.as_view()),
    path("<int:pk>/",         ScanRuleDetailView.as_view()),
    path("<int:pk>/toggle/",  ScanRuleToggleView.as_view()),
]
