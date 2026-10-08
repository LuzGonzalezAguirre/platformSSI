-- CCS: modelo opcional por inspección para productos/QR compartidos entre BUs.
-- Ejecutar ANTES de desplegar el proxy que consulta i.pn_id.
-- No modifica productos ni rellena inspecciones históricas.
USE CCS;
GO
IF COL_LENGTH(N'dbo.ssi_Inspections', N'pn_id') IS NULL
    ALTER TABLE dbo.ssi_Inspections ADD pn_id INT NULL;
GO
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.ssi_Inspections')
      AND name = N'FK_ssi_Inspections_PartNumber'
)
BEGIN
    ALTER TABLE dbo.ssi_Inspections WITH CHECK
    ADD CONSTRAINT FK_ssi_Inspections_PartNumber
        FOREIGN KEY (pn_id) REFERENCES dbo.ssi_PartNumbers(pn_id);
END;
GO
