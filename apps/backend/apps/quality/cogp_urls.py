from django.urls import path
from apps.quality.cogp.views.cogp_views import (
    CogpSummaryView,
    CogpWeeklyTrendView,
    CogpMappingCatalogView,
    CogpParetoView,
    ScrapRateWeeklyView,
    CogpSettingsView,
)

urlpatterns = [
    path("settings/", CogpSettingsView.as_view()),
    path("summary/", CogpSummaryView.as_view()),
    path("weekly-trend/", CogpWeeklyTrendView.as_view()),
    path("mapping/", CogpMappingCatalogView.as_view()),
    path("pareto/", CogpParetoView.as_view()),
    path("scrap-rate/", ScrapRateWeeklyView.as_view()),
]
