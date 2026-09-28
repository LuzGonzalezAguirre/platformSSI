"""Exercise the CCS save path without a live CCS connection."""
import os
import sys
import types
import unittest
from unittest.mock import patch

sys.modules.setdefault('pyodbc', types.ModuleType('pyodbc'))
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import main  # noqa: E402


class Cursor:
    def __init__(self, store):
        self.store = store
        self.result = []
        self.description = None

    def execute(self, sql, *params):
        q = ' '.join(sql.split()).lower()
        self.description = None
        self.result = []
        if 'select 1 from dbo.ssi_businessunits' in q:
            self.result = [(1,)] if params[0] in (1, 2) else []
        elif 'select 1 from dbo.ssi_qwallsamplingmatrix' in q:
            if len(params) == 1:
                self.result = [(1,)] if params[0] == '2.5' else []
            else:
                self.result = [(1,)] if 2 <= params[1] <= 500000 else []
        elif 'select pn_id from dbo.ssi_partnumbers where bu_id' in q:
            self.result = [(10,), (11,)] if params[0] == 1 else []
        elif 'select setting_id from dbo.ssi_qwalllotsettings with' in q:
            row = self.store.get(params[0]); self.result = [(row['setting_id'],)] if row else []
        elif 'insert into dbo.ssi_qwalllotsettings' in q:
            bu_id, mode, size, index, enabled = params
            self.store[bu_id] = dict(setting_id=bu_id, bu_id=bu_id, mode=mode,
                                     general_lot_size=size, inspection_index=index, enabled=enabled)
            self.result = [(bu_id,)]
        elif 'update dbo.ssi_qwalllotsettings' in q:
            mode, size, index, enabled, setting_id = params
            self.store[setting_id].update(mode=mode, general_lot_size=size,
                                          inspection_index=index, enabled=enabled)
        elif 'select setting_id, bu_id, mode' in q:
            row = self.store.get(params[0]); self.result = [tuple(row.values())] if row else []
            self.description = [(key,) for key in ('setting_id', 'bu_id', 'mode', 'general_lot_size', 'inspection_index', 'enabled')]
        elif 'delete from dbo.ssi_qwalllotmodelsettings' in q:
            self.store.setdefault('models', {})[params[0]] = []
        elif 'insert into dbo.ssi_qwalllotmodelsettings' in q:
            self.store.setdefault('models', {}).setdefault(params[0], []).append((params[1], params[2]))
        elif 'select pn_id, lot_size from dbo.ssi_qwalllotmodelsettings' in q:
            self.description = [('pn_id',), ('lot_size',)]
            self.result = self.store.setdefault('models', {}).get(params[0], [])
        elif 'left join dbo.ssi_qwalllotmodelsettings' in q:
            keys = ('setting_id', 'bu_id', 'mode', 'general_lot_size',
                    'inspection_index', 'enabled', 'pn_id', 'lot_size')
            self.description = [(key,) for key in keys]
            self.result = [tuple(row[key] for key in keys[:6]) + (None, None)
                           for bu_id, row in self.store.items() if isinstance(bu_id, int)]
        return self

    def fetchone(self):
        return self.result.pop(0) if self.result else None

    def fetchall(self):
        rows, self.result = self.result, []
        return rows


class Conn:
    def __init__(self, store):
        self.cursor_obj = Cursor(store)
        self.committed = False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True

    def rollback(self):
        pass

    def close(self):
        pass


class LotSamplingSaveTests(unittest.TestCase):
    def test_general_sizes_are_independent_per_bu_and_gap_is_rejected(self):
        store = {}
        connections = []

        def connect():
            conn = Conn(store)
            connections.append(conn)
            return conn

        with patch.object(main, 'get_conn', connect):
            for bu_id, size in ((1, 120), (2, 90)):
                result = main.settings_save_lot_configuration(
                    bu_id, main.LotConfigurationBody(mode='GENERAL', general_lot_size=size,
                                                       inspection_index='2.5', enabled=True),
                )
                self.assertEqual(result['data']['general_lot_size'], size)
            self.assertEqual(store[1]['general_lot_size'], 120)
            self.assertEqual(store[2]['general_lot_size'], 90)
            self.assertTrue(all(c.committed for c in connections))

            overview = main.settings_all_lot_configurations()['data']
            self.assertEqual({row['bu_id']: row['general_lot_size'] for row in overview}, {1: 120, 2: 90})

            from fastapi import HTTPException
            with self.assertRaises(HTTPException) as error:
                main.settings_save_lot_configuration(
                    1, main.LotConfigurationBody(mode='GENERAL', general_lot_size=500500,
                                                  inspection_index='2.5', enabled=True),
                )
            self.assertEqual(error.exception.status_code, 400)
            self.assertEqual(store[1]['general_lot_size'], 120)

    def test_by_model_requires_each_bu_model_when_enabled(self):
        store = {}
        with patch.object(main, 'get_conn', lambda: Conn(store)):
            from fastapi import HTTPException
            incomplete = main.LotConfigurationBody(
                mode='BY_MODEL', inspection_index='2.5', enabled=True,
                models=[main.LotModelBody(pn_id=10, lot_size=120)],
            )
            with self.assertRaises(HTTPException) as error:
                main.settings_save_lot_configuration(1, incomplete)
            self.assertEqual(error.exception.status_code, 400)
            self.assertNotIn(1, store)

            complete = main.LotConfigurationBody(
                mode='BY_MODEL', inspection_index='2.5', enabled=True,
                models=[main.LotModelBody(pn_id=10, lot_size=120),
                        main.LotModelBody(pn_id=11, lot_size=90)],
            )
            result = main.settings_save_lot_configuration(1, complete)
            self.assertEqual({m['pn_id']: m['lot_size'] for m in result['data']['models']}, {10: 120, 11: 90})


if __name__ == '__main__':
    unittest.main()
