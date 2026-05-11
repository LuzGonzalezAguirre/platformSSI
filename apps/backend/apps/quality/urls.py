from django.urls import path
from .views import ScrapDetailView, QualityTargetView, QWallReportView
from .views import RejectionReportView, RejectionPhotoView,RejectionReportPDFView
from .views import QWallPartNumbersView


urlpatterns = [
    path("scrap-detail/",      ScrapDetailView.as_view()),
    path("targets/",           QualityTargetView.as_view()),
    path("targets/<int:pk>/",  QualityTargetView.as_view()),
    path("qwall/",             QWallReportView.as_view()),
    path("rejection-report/",              RejectionReportView.as_view()),
    path("rejection-photo/<int:inspection_id>/", RejectionPhotoView.as_view()),
    path("rejection-report/pdf/",                RejectionReportPDFView.as_view()),
    path("qwall/part-numbers/", QWallPartNumbersView.as_view()),

]