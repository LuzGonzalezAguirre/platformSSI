from django.urls import path
from apps.quality.cogp.views.cogp_views import CogpSummaryView, CogpWeeklyTrendView, CogpMappingCatalogView

urlpatterns = [
    path("summary/", CogpSummaryView.as_view()),
    path("weekly-trend/", CogpWeeklyTrendView.as_view()),
    path("mapping/", CogpMappingCatalogView.as_view()),
]