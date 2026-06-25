"""
0012_drop_scan_rules_from_postgres

Elimina las tablas quality_scan_fields y quality_pn_scan_rules de PostgreSQL.
Los datos ya viven en SQL Server CCS (AAS-PAC-FTP01/CCS).

PREREQUISITO: ejecutar y validar antes de correr esta migración:
  python manage.py migrate_scanrules_to_sqlserver
  python manage.py validate_migration
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("quality", "0011_scanfield_extraction_mode"),
    ]

    operations = [
        # ScanField primero — tiene FK hacia PartNumberScanRule
        migrations.DeleteModel(name="ScanField"),
        migrations.DeleteModel(name="PartNumberScanRule"),
    ]
