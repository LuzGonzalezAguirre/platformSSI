from unittest import TestCase
from unittest.mock import Mock, patch

from apps.quality.tasks import INCOMING_REFRESH_LOCK_KEY
from apps.quality.views.incoming_inspection_views import IncomingInspectionRefreshView


class IncomingInspectionRefreshViewTests(TestCase):
    @patch("apps.quality.views.incoming_inspection_views.uuid4")
    @patch("apps.quality.views.incoming_inspection_views.refresh_incoming_inspection")
    @patch("apps.quality.views.incoming_inspection_views.AsyncResult")
    @patch("apps.quality.views.incoming_inspection_views.cache")
    def test_concurrent_requests_reuse_one_task(
        self,
        cache,
        async_result,
        refresh_task,
        uuid4,
    ):
        store = {}
        uuid4.return_value = "task-1"
        cache.get.side_effect = store.get
        cache.set.side_effect = lambda key, value, timeout: store.__setitem__(key, value)

        def add(key, value, timeout):
            if key in store:
                return False
            store[key] = value
            return True

        cache.add.side_effect = add
        async_result.return_value.state = "PENDING"

        view = IncomingInspectionRefreshView()
        first = view.post(Mock())
        second = view.post(Mock())

        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 202)
        self.assertEqual(first.data["task_id"], "task-1")
        self.assertEqual(second.data["task_id"], "task-1")
        self.assertEqual(store[INCOMING_REFRESH_LOCK_KEY], "task-1")
        refresh_task.apply_async.assert_called_once_with(task_id="task-1")
