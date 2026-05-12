from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ScrapDetailView, QualityTargetView, QWallReportView
from .views import RejectionReportView, RejectionPhotoView,RejectionReportPDFView
from .views import QWallPartNumbersView
from .views import ProblemViewSet, StageViewSet, SLASettingsViewSet

router = DefaultRouter()

# Problem Control routes (NUEVOS)
router.register(r'problems', ProblemViewSet, basename='problem')
router.register(r'stages', StageViewSet, basename='stage')

app_name = 'quality'

urlpatterns = [
    path('', include(router.urls)),
    path("scrap-detail/",      ScrapDetailView.as_view()),
    path("targets/",           QualityTargetView.as_view()),
    path("targets/<int:pk>/",  QualityTargetView.as_view()),
    path("qwall/",             QWallReportView.as_view()),
    path("rejection-report/",              RejectionReportView.as_view()),
    path("rejection-photo/<int:inspection_id>/", RejectionPhotoView.as_view()),
    path("rejection-report/pdf/",                RejectionReportPDFView.as_view()),
    path("qwall/part-numbers/", QWallPartNumbersView.as_view()),
    path(
        'sla-settings/',
        SLASettingsViewSet.as_view({'get': 'list', 'patch': 'update'}),
        name='sla-settings'
    ),

]