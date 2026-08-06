# apps/quality/models/__init__.py
from .quality_target import QualityTarget
from .problem import Problem
from .severity_level import SeverityLevel
from .defect_type import DefectType
from .holiday import Holiday
from .five_why import FiveWhyAnalysis, RootCause
from .actions import (
    ContainmentAction,
    CorrectiveAction,
    VerificationAction,
    PreventionAction,
)
from .attachment import ProblemAttachment, ProblemNote
from .audit import ProblemAudit
from .failure_catalog import FailureModeImage
from .fail_mode_translation import FailModeTranslation
from .qwall_settings import QWallSettings
from .incoming_inspection import (
    IncomingContainerSnapshot,
    IncomingContainerHistory,
    IncomingInspectionSLAConfig,
    IncomingInspectionSyncState,
    IncomingRejectionComment,
)
from ..chatbot.models import (
    ChatbotQuestionTemplate,
    ChatbotFeedback,
    ChatbotSuggestion,
)
from ..cogp.models import (
    CustomerPartMapping,
    BusinessUnit,
    ClassificationSource,
    ScrapRecord,
    ProductionRecord,
    COGPDailySummary,
)

from .downtime_workcenter import DowntimeWorkcenter
from .downtime_workcenter_assignment import DowntimeWorkcenterAssignment
from .downtime_group_assignment import DowntimeGroupAssignment

__all__ = [
    'DowntimeWorkcenter',
    'DowntimeWorkcenterAssignment',
    'DowntimeGroupAssignment',
    'ClassificationSource',
    'QualityTarget',
    'Problem',
    'SeverityLevel',
    'DefectType',
    'Holiday',
    'FiveWhyAnalysis',
    'RootCause',
    'ContainmentAction',
    'CorrectiveAction',
    'VerificationAction',
    'PreventionAction',
    'ProblemAttachment',
    'ProblemNote',
    'ProblemAudit',
    'FailureModeImage',
    'FailModeTranslation',
    'QWallSettings',
    'IncomingContainerSnapshot',
    'IncomingContainerHistory',
    'IncomingInspectionSLAConfig',
    'IncomingInspectionSyncState',
    'IncomingRejectionComment',
    'ChatbotQuestionTemplate',
    'ChatbotFeedback',
    'ChatbotSuggestion',
    'CustomerPartMapping',
    'BusinessUnit',
    'ScrapRecord',
    'ProductionRecord',
    'COGPDailySummary',
]