from django.urls import path
from apps.ssi_common.views import FilterChoicesView

urlpatterns = [
    path("filter-choices/", FilterChoicesView.as_view()),
]