from django.test import SimpleTestCase

from apps.warehouse.tasks import build_demand_teams_payload


class DemandTeamsPayloadTests(SimpleTestCase):
    def test_teams_adaptive_card_contract(self):
        payload = build_demand_teams_payload({
            "Release_Key": 618734191,
            "Customer": "Deere & Company",
            "PO_Rel": "5500146407",
            "Part_No_Rev": "43422.3 Rev:2",
            "Cust_Part": "DZ133884",
            "Rel_Qty": 262,
            "Ship_Date": "2026-10-15T00:00:00",
            "Rel_Type": "Firm (862)",
            "Changed_By": "Paola Lopez",
            "Note": "",
        })
        self.assertEqual(payload["release_key"], 618734191)
        self.assertEqual(payload["tipo_alerta"], "DEMAND_NEW_RELEASE")
        attachment = payload["attachments"][0]
        self.assertEqual(attachment["contentType"], "application/vnd.microsoft.card.adaptive")
        self.assertEqual(attachment["content"]["type"], "AdaptiveCard")
        facts = attachment["content"]["body"][1]["facts"]
        self.assertEqual(facts[0]["value"], "Deere & Company")
        self.assertEqual(facts[5]["value"], "2026-10-15")
        self.assertEqual(facts[7]["value"], "Paola Lopez")
        self.assertEqual(facts[8]["value"], " ")
        self.assertEqual(payload["note"], "")
