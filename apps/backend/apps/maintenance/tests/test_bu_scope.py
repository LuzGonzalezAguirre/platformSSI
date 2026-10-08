from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from apps.identity.models import User
from apps.maintenance.services.maintenance_service import MaintenanceService
from apps.ssi_common.filters.base import FilterContext


class MaintenanceBUScopeViewTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            employee_id="mbu-test",
            password="Password123!",
        )

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    @patch(
        "apps.maintenance.views.overview_views.get_allowed_bu_for_user",
        return_value=("VOLVO",),
    )
    @patch(
        "apps.maintenance.views.overview_views."
        "MaintenanceService.get_downtime_reasons_scoped",
        return_value={"data": []},
    )
    def test_reasons_uses_effective_bu_scope(self, service, allowed):
        response = self.client.get(
            "/api/v1/maintenance/overview/reasons/"
            "?start_date=2026-10-01&end_date=2026-10-02"
        )

        self.assertEqual(response.status_code, 200)
        ctx = service.call_args.args[0]
        self.assertEqual(ctx.bu, ("VOLVO",))

    @patch(
        "apps.maintenance.views.overview_views.get_allowed_bu_for_user",
        return_value=("VOLVO",),
    )
    @patch(
        "apps.maintenance.views.overview_views."
        "MaintenanceService.get_downtime_detail_scoped",
        return_value={"data": []},
    )
    def test_detail_intersects_requested_bu_with_allowed_bu(self, service, allowed):
        response = self.client.get(
            "/api/v1/maintenance/overview/detail/"
            "?start_date=2026-10-01&end_date=2026-10-02"
            "&bu=VOLVO&bu=CUMMINS&reason=Equipment"
        )

        self.assertEqual(response.status_code, 200)
        ctx = service.call_args.args[0]
        self.assertEqual(ctx.bu, ("VOLVO",))
        self.assertEqual(service.call_args.args[1], "Equipment")

    @patch(
        "apps.maintenance.views.overview_views.get_allowed_bu_for_user",
        return_value=("VOLVO",),
    )
    @patch(
        "apps.maintenance.views.overview_views."
        "MaintenanceService.get_oee_trend_live_scoped",
        return_value=[],
    )
    def test_oee_trend_uses_same_bu_scope(self, service, allowed):
        response = self.client.get(
            "/api/v1/maintenance/overview/oee-trend/"
            "?start_date=2026-10-01&end_date=2026-10-02"
        )

        self.assertEqual(response.status_code, 200)
        ctx = service.call_args.args[0]
        self.assertEqual(ctx.bu, ("VOLVO",))


class MaintenanceBUScopeServiceTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.ctx = FilterContext(
            start_date=__import__("datetime").date(2026, 10, 1),
            end_date=__import__("datetime").date(2026, 10, 2),
            bu=("VOLVO",),
        )

    @patch("apps.maintenance.services.maintenance_service._post")
    def test_reasons_excludes_rows_outside_allowed_bu(self, post):
        post.return_value = {
            "data": [
                {
                    "reason": "Equipment",
                    "workcenter": "HM Ensamble Final 2",
                    "workcenter_group": "Heater Module",
                    "total_events": 2,
                    "total_hours": 3.0,
                },
                {
                    "reason": "Equipment",
                    "workcenter": "HM Weld",
                    "workcenter_group": "Heater Module",
                    "total_events": 5,
                    "total_hours": 8.0,
                },
            ]
        }

        result = MaintenanceService.get_downtime_reasons_scoped(self.ctx)

        self.assertEqual(result["grand_total_hours"], 3.0)
        self.assertEqual(result["data"][0]["total_events"], 2)

    @patch("apps.maintenance.services.maintenance_service._post")
    def test_oee_recalculates_total_after_bu_filter(self, post):
        post.return_value = {
            "data": {
                "details": [
                    {
                        "workcenter": "HM Ensamble Final 2",
                        "workcenter_group": "Heater Module",
                        "good_qty": 90,
                        "scrap_qty": 10,
                        "total_qty": 100,
                        "operating_hours": 8,
                        "plan_hours": 10,
                        "ideal_hours_total": 6,
                    },
                    {
                        "workcenter": "HM Weld",
                        "workcenter_group": "Heater Module",
                        "good_qty": 1000,
                        "scrap_qty": 0,
                        "total_qty": 1000,
                        "operating_hours": 20,
                        "plan_hours": 20,
                        "ideal_hours_total": 20,
                    },
                ]
            }
        }

        result = MaintenanceService.get_oee_live_scoped(self.ctx)

        self.assertEqual(result["good_qty"], 90)
        self.assertEqual(result["total_qty"], 100)
        self.assertEqual(result["availability_pct"], 80.0)
        self.assertEqual(result["performance_pct"], 75.0)
        self.assertEqual(result["quality_pct"], 90.0)
        self.assertEqual(result["oee_pct"], 54.0)

    @patch("apps.maintenance.services.maintenance_service._post")
    def test_kpi_aggregation_uses_only_allowed_bu(self, post):
        post.return_value = {
            "data": {"operating_hours": 28, "unplanned_failures": 7},
            "by_workcenter": [
                {
                    "workcenter": "HM Ensamble Final 2",
                    "workcenter_group": "Heater Module",
                    "operating_hours": 8,
                    "downtime_hours": 2,
                    "down_hours": 2,
                    "setup_hours": 0,
                    "idle_hours": 0,
                    "total_failures": 1,
                },
                {
                    "workcenter": "HM Weld",
                    "workcenter_group": "Heater Module",
                    "operating_hours": 20,
                    "downtime_hours": 5,
                    "down_hours": 5,
                    "setup_hours": 0,
                    "idle_hours": 0,
                    "total_failures": 2,
                },
            ]
        }

        result = MaintenanceService.get_kpis(self.ctx)["data"]

        self.assertEqual(result["operating_hours"], 8.0)
        self.assertEqual(result["downtime_hours"], 2.0)
        self.assertEqual(result["total_failures"], 7)
        self.assertEqual(result["down_events"], 1)
        self.assertEqual(result["mttr_hours"], 2.0)
        self.assertEqual(result["mtbf_operating_hours"], 28.0)
        self.assertEqual(result["mtbf_hours"], 4.0)
        self.assertEqual(result["availability_pct"], 80.0)

    @patch("apps.maintenance.services.maintenance_service._post")
    def test_kpis_zero_unplanned_requests_returns_no_mtbf(self, post):
        post.return_value = {
            "data": {"operating_hours": 100, "unplanned_failures": 0},
            "by_workcenter": [],
        }

        result = MaintenanceService.get_kpis(self.ctx)["data"]

        self.assertEqual(result["total_failures"], 0)
        self.assertIsNone(result["mtbf_hours"])

    @patch("apps.maintenance.services.maintenance_service._post")
    def test_kpis_requires_updated_proxy(self, post):
        post.return_value = {"data": {"operating_hours": 100}, "by_workcenter": []}

        with self.assertRaisesRegex(RuntimeError, "plex-proxyO"):
            MaintenanceService.get_kpis(self.ctx)
