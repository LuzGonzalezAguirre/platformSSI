from django.urls import path
from .views.kpi_views import KpiView
from .views.breaks_views import BreaksListView, BreaksDailyChartView, BreaksTurnoChartView
from .views.pdf_views import ChairPdfReportView

urlpatterns = [
    path("kpis/",          KpiView.as_view(),             name="ssi-chairs-kpis"),
    path("breaks/",        BreaksListView.as_view(),       name="ssi-chairs-breaks"),
    path("charts/daily/",  BreaksDailyChartView.as_view(), name="ssi-chairs-chart-daily"),
    path("charts/turno/",  BreaksTurnoChartView.as_view(), name="ssi-chairs-chart-turno"),
    path("pdf/",           ChairPdfReportView.as_view(),   name="ssi-chairs-pdf"),
]
