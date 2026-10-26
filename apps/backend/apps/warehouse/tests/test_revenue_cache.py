from unittest.mock import Mock, patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from apps.warehouse.services.plex_client import PlexProxyError
from apps.warehouse.services.warehouse_service import WarehouseService


@override_settings(PLEX_CACHE_TTL=60)
class RevenueCacheTest(SimpleTestCase):
    def setUp(self):
        self.service = WarehouseService()
        self.key = self.service._cache_key("revenue_test", period="2026-10")
        cache.delete(self.key)
        cache.delete(self.key + ":fetch_lock")

    def tearDown(self):
        cache.delete(self.key)
        cache.delete(self.key + ":fetch_lock")

    def test_cache_hit_avoids_proxy(self):
        fetch = Mock(return_value=[{"Revenue": 10}])
        assert self.service._get_or_fetch_revenue(
            "revenue_test", fetch, period="2026-10"
        ) == [{"Revenue": 10}]
        assert self.service._get_or_fetch_revenue(
            "revenue_test", fetch, period="2026-10"
        ) == [{"Revenue": 10}]
        fetch.assert_called_once()

    def test_failed_proxy_does_not_cache_a_false_success(self):
        fetch = Mock(side_effect=PlexProxyError("timeout"))
        with self.assertRaises(PlexProxyError):
            self.service._get_or_fetch_revenue(
                "revenue_test", fetch, period="2026-10"
            )
        self.assertIsNone(cache.get(self.key))
        self.assertIsNone(cache.get(self.key + ":fetch_lock"))

    def test_concurrent_request_uses_other_fetch_result(self):
        cache.add(self.key + ":fetch_lock", "1", timeout=60)
        def publish_result(_seconds):
            cache.set(self.key, [{"Revenue": 23}], timeout=60)
        with patch("apps.warehouse.services.warehouse_service.time.sleep", side_effect=publish_result):
            result = self.service._get_or_fetch_revenue(
                "revenue_test", Mock(side_effect=AssertionError("duplicate query")),
                period="2026-10",
            )
        self.assertEqual(result, [{"Revenue": 23}])
