# apps/quality/urls.py
from django.urls import path, include
from apps.quality.views import (
    FailureCatalogView,
    CatalogStructureView,
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
    ContainmentActionListCreateView,
    ContainmentActionDetailView,
    FiveWhyAnalysisListCreateView,
    FiveWhyAnalysisDetailView,
    RootCauseListCreateView,
    RootCauseDetailView,
    CorrectiveActionListCreateView,
    CorrectiveActionDetailView,
    VerificationActionListCreateView,
    VerificationActionDetailView,
    PreventionActionListCreateView,
    PreventionActionDetailView,
    ProblemAttachmentUploadView,
    ProblemAttachmentListView,
    ProblemAttachmentDeleteView,
    ProblemNoteListCreateView,
    ProblemNoteDetailView,
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

    # ═════════════════════════════════════════════════════════════════════
    # ACTION ENDPOINTS
    # ═════════════════════════════════════════════════════════════════════
    path("containment-actions/", ContainmentActionListCreateView.as_view(), name="containment-action-list"),
    path("containment-actions/<int:pk>/", ContainmentActionDetailView.as_view(), name="containment-action-detail"),

    # ═════════════════════════════════════════════════════════════════════
    # FIVE WHY & ROOT CAUSE (Step 4)
    # ═════════════════════════════════════════════════════════════════════
    path("five-why-analyses/", FiveWhyAnalysisListCreateView.as_view(), name="five-why-list"),
    path("five-why-analyses/<int:pk>/", FiveWhyAnalysisDetailView.as_view(), name="five-why-detail"),
    path("root-causes/", RootCauseListCreateView.as_view(), name="root-cause-list"),
    path("root-causes/<int:pk>/", RootCauseDetailView.as_view(), name="root-cause-detail"),

    # ═════════════════════════════════════════════════════════════════════
    # CORRECTIVE ACTIONS (Step 5)
    # ═════════════════════════════════════════════════════════════════════
    path("corrective-actions/", CorrectiveActionListCreateView.as_view(), name="corrective-action-list"),
    path("corrective-actions/<int:pk>/", CorrectiveActionDetailView.as_view(), name="corrective-action-detail"),

    # ═════════════════════════════════════════════════════════════════════
    # VERIFICATION ACTIONS (Step 6)
    # ═════════════════════════════════════════════════════════════════════
    path("verification-actions/", VerificationActionListCreateView.as_view(), name="verification-action-list"),
    path("verification-actions/<int:pk>/", VerificationActionDetailView.as_view(), name="verification-action-detail"),

    # ═════════════════════════════════════════════════════════════════════
    # PREVENTION ACTIONS (Step 7)
    # ═════════════════════════════════════════════════════════════════════
    path("prevention-actions/", PreventionActionListCreateView.as_view(), name="prevention-action-list"),
    path("prevention-actions/<int:pk>/", PreventionActionDetailView.as_view(), name="prevention-action-detail"),

    # ═════════════════════════════════════════════════════════════════════
    # ATTACHMENTS
    # ═════════════════════════════════════════════════════════════════════
    path("attachments/upload/", ProblemAttachmentUploadView.as_view(), name="attachment-upload"),
    path("attachments/", ProblemAttachmentListView.as_view(), name="attachment-list"),
    path("attachments/<int:pk>/", ProblemAttachmentDeleteView.as_view(), name="attachment-delete"),

    # ═════════════════════════════════════════════════════════════════════
    # NOTES
    # ═════════════════════════════════════════════════════════════════════
    path("notes/", ProblemNoteListCreateView.as_view(), name="note-list-create"),
    path("notes/<int:pk>/", ProblemNoteDetailView.as_view(), name="note-detail"),

    # ═════════════════════════════════════════════════════════════════════
    # CATÁLOGO DE FALLAS
    # ═════════════════════════════════════════════════════════════════════
    path("catalog/structure/", CatalogStructureView.as_view(), name="catalog-structure"),
    path("catalog/", FailureCatalogView.as_view(), name="failure-catalog"),

    # ═════════════════════════════════════════════════════════════════════
    # QWALL SETTINGS CRUD
    # ═════════════════════════════════════════════════════════════════════
    path("qwall/settings/", include("apps.quality.qwall_settings_urls")),

    # ═════════════════════════════════════════════════════════════════════
    # SCAN RULES (PostgreSQL — configuración de parseo de código de barras)
    # ═════════════════════════════════════════════════════════════════════
    path("scan-rules/", include("apps.quality.scan_rules_urls")),
]