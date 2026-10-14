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
        get_flags.return_value = [{"flag_id": 17, "comment": "Visual check", "has_photo": 1, "part_number": "35496.2", "total_photos": 1, "frame_sn": "ABC", "created_at": "2026-10-07T10:00:00"}]
        response = FlagReportView().get(self.request(start_date="2026-10-01", end_date="2026-10-14"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["data"][0]["comment"], "Visual check")
        self.assertIsNone(get_flags.call_args.args[2])

    @patch("apps.quality.views.flag_views.QWallRepository.get_piece_flags")
    def test_outdated_proxy_contract_returns_error(self, get_flags):
        get_flags.return_value = [{"flag_id": 17, "comment": "Old payload"}]
        response = FlagReportView().get(self.request(start_date="2026-10-01", end_date="2026-10-14"))
        self.assertEqual(response.status_code, 502)
        self.assertIn("Proxy", response.data["detail"])

    @patch("apps.quality.views.flag_views.FlagPhotoRepository.get_photos")
    def test_flag_photo_gallery_endpoint(self, get_photos):
        from apps.quality.views.flag_views import FlagPhotosView
        get_photos.return_value = {"data": [{"photo_id": 123, "photo_b64": "Zm9v", "taken_at": None}]}
        response = FlagPhotosView().get(self.request(), 53)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"][0]["photo_id"], 123)
        get_photos.assert_called_once_with(53)

    @patch("apps.quality.views.flag_views.QWallRepository.get_piece_flags")
    def test_proxy_missing_columns_error_is_explained(self, get_flags):
        get_flags.side_effect = ValueError("Q-Wall Proxy /piece-flags: Columnas faltantes: part_number")
        response = FlagReportView().get(self.request(start_date="2026-10-01", end_date="2026-10-14"))
        self.assertEqual(response.status_code, 502)
        self.assertIn("part_number", response.data["detail"])
