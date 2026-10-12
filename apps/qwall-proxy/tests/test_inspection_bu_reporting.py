"""Verify reporting queries against local fixtures; never connect to CCS."""
import ast
from pathlib import Path
import re
import sqlite3
from types import SimpleNamespace
import unittest


class InspectionBuReportingTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.executescript('''
            CREATE TABLE ssi_BusinessUnits(bu_id INT, bu_name TEXT);
            INSERT INTO ssi_BusinessUnits VALUES (3,'Cummins'),(10,'TULC');
            CREATE TABLE ssi_PartNumbers(pn_id INT, bu_id INT, ssiPN TEXT);
            INSERT INTO ssi_PartNumbers VALUES (1,10,'35482.2'),(2,3,'35496.2');
            CREATE TABLE ssi_Products(product_id INT, pn_id INT);
            INSERT INTO ssi_Products VALUES (1,1),(2,2),(3,1);
            CREATE TABLE ssi_Inspections(inspection_id INT, product_id INT, bu_id INT, pn_id INT, started_at TEXT);
            INSERT INTO ssi_Inspections VALUES
                (1,1,3,2,'2026-10-07'),(2,2,10,NULL,'2026-10-07'),(3,3,NULL,NULL,'2026-10-07');
            CREATE TABLE ssi_FailModes(fail_mode_id INT, fail_code TEXT, description TEXT);
            INSERT INTO ssi_FailModes VALUES (179,'D-1','Daño en tubo');
            CREATE TABLE ssi_PieceFlagRecords(flag_id INT, inspection_id INT, product_id INT,
                comment TEXT, fail_mode_id INT, created_at TEXT);
            INSERT INTO ssi_PieceFlagRecords VALUES
                (1,1,1,'A',179,'2026-10-07'),(2,2,2,'B',179,'2026-10-07'),
                (3,3,3,'C',179,'2026-10-07');
        ''')
        db = self.db

        class Cursor:
            def execute(self, sql, *params):
                if 'STUFF(' in sql:
                    # Use the actual SELECT expression and filter emitted by the endpoint.
                    expr = re.search(r'(COALESCE\([^\n]+?\))\s+AS bu_id', sql)[1]
                    model = re.search(r'ON (COALESCE\(i.pn_id, p.pn_id\)|p.pn_id)\s*=\s*pn.pn_id', sql)[1]
                    scope = re.search(r'(AND COALESCE\(i.bu_id, pn.bu_id\) IN \([^\n]+\))', sql)
                    sql = f'''SELECT i.inspection_id, {expr} AS bu_id, bu.bu_name, pn.ssiPN AS part_number
                        FROM ssi_Inspections i
                        JOIN ssi_Products p ON i.product_id=p.product_id
                        JOIN ssi_PartNumbers pn ON {model}=pn.pn_id
                        LEFT JOIN ssi_BusinessUnits bu ON bu.bu_id={expr}
                        WHERE i.started_at BETWEEN ? AND ? {scope[1] if scope else ''}'''
                else:
                    sql = sql.replace('CAST(pfr.created_at AS DATE)', 'DATE(pfr.created_at)')
                self.cursor = db.execute(sql, params)
                self.description = self.cursor.description
                return self

            def fetchone(self):
                return self.cursor.fetchone()

            def fetchall(self):
                return self.cursor.fetchall()

        class Connection:
            def cursor(self):
                return Cursor()

            def close(self):
                pass

        # Load only the read endpoints, avoiding environment/authentication imports.
        tree = ast.parse((Path(__file__).parents[1] / 'main.py').read_text())
        names = {'get_inspections','piece_flags','piece_flags_count','_rows_to_dicts'}
        funcs = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
        for fn in funcs:
            fn.decorator_list = []
        namespace = dict(get_conn=Connection, Query=lambda value: value,
                         DateRange=SimpleNamespace, HTTPException=RuntimeError)
        exec(compile(ast.Module(body=funcs, type_ignores=[]), 'report-endpoints', 'exec'), namespace)
        self.api = namespace

    def tearDown(self):
        self.db.close()

    def inspections(self, ids):
        return self.api['get_inspections'](SimpleNamespace(
            start_date='2026-10-07', end_date='2026-10-07', bu_ids=ids))['data']

    def flags(self, ids=None, legacy=None):
        return self.api['piece_flags']('2026-10-07','2026-10-07',legacy,ids)['data']

    def test_inspection_bu_overrides_model_for_cummins(self):
        rows = self.inspections([3])
        self.assertEqual([(r['inspection_id'],r['bu_id'],r['bu_name']) for r in rows],
                         [(1,3,'Cummins')])

    def test_model_override_preserves_other_inspection_of_same_product(self):
        self.db.execute("INSERT INTO ssi_Inspections VALUES (4,1,10,NULL,'2026-10-07')")
        rows = {r['inspection_id']: r for r in self.inspections(None)}
        self.assertEqual(rows[1]['part_number'], '35496.2')
        self.assertEqual(rows[4]['part_number'], '35482.2')
        self.assertEqual(self.db.execute('SELECT pn_id FROM ssi_Products WHERE product_id=1').fetchone()[0], 1)

    def test_tulc_includes_override_and_legacy_null(self):
        rows = self.inspections([10])
        self.assertEqual({r['inspection_id'] for r in rows}, {2,3})
        self.assertEqual({r['bu_name'] for r in rows}, {'TULC'})

    def test_all_and_multi_bu_preserve_each_inspection(self):
        self.assertEqual(len(self.inspections(None)),3)
        self.assertEqual(len(self.inspections([3,10])),3)

    def test_flag_count_and_detail_follow_inspection_bu(self):
        for ids, expected in [([3],{1}),([10],{2,3}),([3,10],{1,2,3})]:
            self.assertEqual({r['inspection_id'] for r in self.flags(ids)},expected)
            count = self.api['piece_flags_count']('2026-10-07','2026-10-07',ids)
            self.assertEqual(count['flag_count'],len(expected))

    def test_flags_support_old_single_bu_parameter(self):
        self.assertEqual({r['inspection_id'] for r in self.flags(legacy=3)}, {1})

    def test_flags_without_bu_return_all(self):
        self.assertEqual(len(self.flags()),3)


if __name__ == '__main__':
    unittest.main()
