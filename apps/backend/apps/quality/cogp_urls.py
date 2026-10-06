from django.urls import path
from apps.permissions.drf import quality_view
from apps.quality.cogp.views.cogp_views import (
    CogpSummaryView,
    CogpWeeklyTrendView,
    CogpMappingCatalogView,
    CogpParetoView,
    ScrapRateWeeklyView,
    CogpSettingsView,
    CogpScrapIntegrationTestView,
    CogpCurrentOffendersView,
)

urlpatterns = [
    path("settings/", quality_view(CogpSettingsView)),
    path("scrap-integration/test/", quality_view(CogpScrapIntegrationTestView)),
    path("scrap-integration/current-offenders/", quality_view(CogpCurrentOffendersView)),
    path("summary/", quality_view(CogpSummaryView)),
    path("weekly-trend/", quality_view(CogpWeeklyTrendView)),
    path("mapping/", quality_view(CogpMappingCatalogView)),
    path("pareto/", quality_view(CogpParetoView)),
    path("scrap-rate/", quality_view(ScrapRateWeeklyView)),
]
