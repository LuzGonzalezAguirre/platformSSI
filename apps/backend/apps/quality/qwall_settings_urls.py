from django.urls import path
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
)

urlpatterns = [
    path("business-units/",                              QWallBusinessUnitsView.as_view()),
    path("qwall-roles/",                                 QWallRolesView.as_view()),
    path("users/",                                       QWallUsersView.as_view()),
    path("users/<int:user_id>/",                         QWallUserDetailView.as_view()),
    path("part-numbers/",                                QWallPartNumbersView.as_view()),
    path("part-numbers/<int:pn_id>/",                    QWallPartNumberDetailView.as_view()),
    path("inspection-points/",                           QWallInspectionPointsView.as_view()),
    path("inspection-points/<int:point_id>/",            QWallInspectionPointDetailView.as_view()),
    path("fail-modes/",                                  QWallFailModesView.as_view()),
    path("fail-modes/<int:fail_mode_id>/",               QWallFailModeDetailView.as_view()),
    path("fail-modes/<int:fail_mode_id>/assign-points/", QWallFailModeAssignPointsView.as_view()),
    path("system-config/",                               QWallSystemConfigView.as_view()),
    path("system-config/<str:config_key>/",              QWallSystemConfigDetailView.as_view()),
]
