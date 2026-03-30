from django.urls import path
from apps.permissions.views import (
    PermissionChoicesView,
    RoleListCreateView,
    RoleDetailView,
    UserPermissionsView,
    MyPermissionsView,
)

urlpatterns = [
    path("", PermissionChoicesView.as_view(), name="permission-choices"),
    path("roles/", RoleListCreateView.as_view(), name="role-list-create"),
    path("roles/<str:slug>/", RoleDetailView.as_view(), name="role-detail"),
    path("users/<int:user_id>/", UserPermissionsView.as_view(), name="user-permissions"),
    path("me/", MyPermissionsView.as_view(), name="my-permissions"),
]