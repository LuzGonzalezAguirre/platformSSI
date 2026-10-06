from django.urls import path
from apps.permissions.drf import quality_view
from apps.quality.views.qwall_settings_views import (
    QWallBusinessUnitsView,
    QWallRolesView,
    QWallUsersView,
    QWallUserDetailView,
    QWallPartNumbersView,
    QWallPartNumberDetailView,
    QWallInspectionPointsView,
    QWallInspectionPointDetailView,
    QWallFailModesView,
    QWallFailModeDetailView,
    QWallFailModeAssignPointsView,
    QWallSystemConfigView,
    QWallSystemConfigDetailView,
    QWallFailModeTranslationsView,
    QWallFailModeTranslationsMissingView,
    QWallFailModeTranslationDetailView,
    QWallPassRateTargetView,
)

from apps.quality.views.lot_sampling_views import QWallSamplingMatrixView, QWallLotConfigurationView, QWallLotConfigurationsView

urlpatterns = [
    path("lot-sampling/matrix/", quality_view(QWallSamplingMatrixView)),
    path("lot-sampling/configurations/", quality_view(QWallLotConfigurationsView)),
    path("lot-sampling/<int:bu_id>/", quality_view(QWallLotConfigurationView)),
    path("business-units/",                              quality_view(QWallBusinessUnitsView)),
    path("qwall-roles/",                                 quality_view(QWallRolesView)),
    path("users/",                                       quality_view(QWallUsersView)),
    path("users/<int:user_id>/",                         quality_view(QWallUserDetailView)),
    path("part-numbers/",                                quality_view(QWallPartNumbersView)),
    path("part-numbers/<int:pn_id>/",                    quality_view(QWallPartNumberDetailView)),
    path("inspection-points/",                           quality_view(QWallInspectionPointsView)),
    path("inspection-points/<int:point_id>/",            quality_view(QWallInspectionPointDetailView)),
    path("fail-modes/",                                  quality_view(QWallFailModesView)),
    path("fail-modes/<int:fail_mode_id>/",               quality_view(QWallFailModeDetailView)),
    path("fail-modes/<int:fail_mode_id>/assign-points/", quality_view(QWallFailModeAssignPointsView)),
    path("system-config/",                               quality_view(QWallSystemConfigView)),
    path("system-config/<str:config_key>/",              quality_view(QWallSystemConfigDetailView)),
    path("fail-mode-translations/",                      quality_view(QWallFailModeTranslationsView)),
    path("fail-mode-translations/missing/",              quality_view(QWallFailModeTranslationsMissingView)),
    path("fail-mode-translations/<str:fail_mode_code>/", quality_view(QWallFailModeTranslationDetailView)),
    path("pass-rate-target/",                             quality_view(QWallPassRateTargetView)),
]
