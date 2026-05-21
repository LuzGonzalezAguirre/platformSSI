# apps/quality/views/__init__.py
from .scrap_views import ScrapDetailView
from .targets_views import QualityTargetView
from .qwall_views import QWallReportView, QWallPartNumbersView
from .rejection_views import RejectionReportView, RejectionPhotoView, RejectionReportPDFView
from .problem_views import (
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

__all__ = [
    'ScrapDetailView',
    'QualityTargetView',
    'QWallReportView',
    'QWallPartNumbersView',
    'RejectionReportView',
    'RejectionPhotoView',
    'RejectionReportPDFView',
    'ProblemListCreateView',
    'ProblemDetailView',
    'ProblemSubmitView',
    'ProblemApproveView',
    'ProblemRejectView',
    'ProblemCloseView',
    'ProblemOverrideRequestView',
    'ProblemOverrideApproveView',
    'SeverityLevelListView',
    'DefectTypeListView',
    'QualityUsersListView',
    'QualityManagersListView',
]