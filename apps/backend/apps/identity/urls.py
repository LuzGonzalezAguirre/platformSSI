from django.urls import path
from apps.identity.views import (
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    UserListCreateView,
    UserDetailView,
    ToggleActiveView,
    ResetPasswordView,
    RoleChoicesView,
    ProfileUpdateView,
    ChangePasswordView,
    AvatarUploadView,
)


urlpatterns = [
    # Auth
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),

    # Profile
    path("me/update/", ProfileUpdateView.as_view(), name="profile-update"),
    path("me/change-password/", ChangePasswordView.as_view(), name="profile-change-password"),
    path("me/avatar/", AvatarUploadView.as_view(), name="profile-avatar"),
    
    # Users
    path("users/", UserListCreateView.as_view(), name="user-list-create"),
    path("users/<int:user_id>/", UserDetailView.as_view(), name="user-detail"),
    path("users/<int:user_id>/toggle-active/", ToggleActiveView.as_view(), name="user-toggle-active"),
    path("users/<int:user_id>/reset-password/", ResetPasswordView.as_view(), name="user-reset-password"),

    # Catalogs
    path("roles/", RoleChoicesView.as_view(), name="role-choices"),
]