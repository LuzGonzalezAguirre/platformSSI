from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from apps.quality.views.flag_views import FlagReportView


class FlagReportViewTests(SimpleTestCase):
    def request(self, **params):
        return SimpleNamespace(query_params=params)

    def test_dates_required(self):
        response = FlagReportView().get(self.request())
        self.assertEqual(response.status_code, 400)

    def test_date_order_validated(self):
        response = FlagReportView().get(self.request(start_date="2026-10-14", end_date="2026-10-01"))
        self.assertEqual(response.status_code, 400)

    def test_bu_must_be_positive_integer(self):
        response = FlagReportView().get(self.request(start_date="2026-10-01", end_date="2026-10-14", bu_id="-3"))
        self.assertEqual(response.status_code, 400)

    @patch("apps.quality.views.flag_views.QWallRepository.get_piece_flags")
    def test_returns_flag_records_without_mutation(self, get_flags):
        get_flags.return_value = [{"flag_id": 17, "comment": "Visual check", "has_photo": 0}]
        response = FlagReportView().get(self.request(start_date="2026-10-01", end_date="2026-10-14"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["data"][0]["comment"], "Visual check")
        self.assertIsNone(get_flags.call_args.args[2])
