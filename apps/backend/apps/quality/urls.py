from django.urls import path
from .views import ScrapDetailView, QualityTargetView

urlpatterns = [
    path("scrap-detail/",      ScrapDetailView.as_view()),
    path("targets/",           QualityTargetView.as_view()),
    path("targets/<int:pk>/",  QualityTargetView.as_view()),
]