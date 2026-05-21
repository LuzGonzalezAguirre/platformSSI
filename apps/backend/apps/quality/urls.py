# apps/quality/urls.py
from django.urls import path
from apps.quality.views import (
    ScrapDetailView,
    QualityTargetView,
    QWallReportView,
    QWallPartNumbersView,
    RejectionReportView,
    RejectionPhotoView,
    RejectionReportPDFView,
    ProblemListCreateView,
    ProblemDetailView,
    ProblemSubmitView,
    ProblemApproveView,
    ProblemRejectView,
    ProblemCloseView,
    ProblemOverrideRequestView,
    ProblemOverrideApproveView,
    SeverityLevelListView,
    DefectTypeListView,
    QualityUsersListView,
    QualityManagersListView,
)

urlpatterns = [
    # ═════════════════════════════════════════════════════════════════════
    # EXISTING ENDPOINTS
    # ═════════════════════════════════════════════════════════════════════
    path("scrap-detail/", ScrapDetailView.as_view()),
    path("targets/", QualityTargetView.as_view()),
    path("targets/<int:pk>/", QualityTargetView.as_view()),
    path("qwall/", QWallReportView.as_view()),
    path("qwall/part-numbers/", QWallPartNumbersView.as_view()),
    path("rejection-report/", RejectionReportView.as_view()),
    path("rejection-photo/<int:inspection_id>/", RejectionPhotoView.as_view()),
    path("rejection-report/pdf/", RejectionReportPDFView.as_view()),

    # ═════════════════════════════════════════════════════════════════════
    # PROBLEM CONTROL ENDPOINTS
    # ═════════════════════════════════════════════════════════════════════
    
    # CRUD
    path("problems/", ProblemListCreateView.as_view(), name="problem-list-create"),
    path("problems/<int:pk>/", ProblemDetailView.as_view(), name="problem-detail"),
    
    # Workflow actions
    path("problems/<int:pk>/submit/", ProblemSubmitView.as_view(), name="problem-submit"),
    path("problems/<int:pk>/approve/", ProblemApproveView.as_view(), name="problem-approve"),
    path("problems/<int:pk>/reject/", ProblemRejectView.as_view(), name="problem-reject"),
    path("problems/<int:pk>/close/", ProblemCloseView.as_view(), name="problem-close"),
    
    # Override workflow
    path("problems/<int:pk>/override/request/", ProblemOverrideRequestView.as_view(), name="problem-override-request"),
    path("problems/<int:pk>/override/approve/", ProblemOverrideApproveView.as_view(), name="problem-override-approve"),
    
    # ═════════════════════════════════════════════════════════════════════
    # CATALOGS (IMPORTANTE — ESTAS SON LAS QUE FALTAN)
    # ═════════════════════════════════════════════════════════════════════
    path("severity-levels/", SeverityLevelListView.as_view(), name="severity-levels"),
    path("defect-types/", DefectTypeListView.as_view(), name="defect-types"),
    path("quality-users/", QualityUsersListView.as_view(), name="quality-users"),
    path("quality-managers/", QualityManagersListView.as_view(), name="quality-managers"),
]