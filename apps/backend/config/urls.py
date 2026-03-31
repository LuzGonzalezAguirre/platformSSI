from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

API_V1 = "api/v1/"

urlpatterns = [
    path("admin/", admin.site.urls),
    path(f"{API_V1}auth/", include("apps.identity.urls")),
    path(f"{API_V1}permissions/", include("apps.permissions.urls")),
    path(f"{API_V1}manufacturing/", include("apps.manufacturing.urls")),
    path(f"{API_V1}maintenance/", include("apps.maintenance.urls")),
    path(f"{API_V1}analytics/", include("apps.analytics.urls")),
    path(f"{API_V1}warehouse/", include("apps.warehouse.urls")),
    path(f"{API_V1}production/", include("apps.production.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]