from rest_framework import serializers


class PartRevisionSerializer(serializers.Serializer):
    Part_No   = serializers.CharField()
    Revision  = serializers.CharField()
    Part_Name = serializers.CharField()


class BomHierarchySerializer(serializers.Serializer):
    level              = serializers.IntegerField()
    original_part_no   = serializers.CharField()
    original_part_name = serializers.CharField()
    part_no_rev        = serializers.CharField()
    part_name          = serializers.CharField()
    quantity           = serializers.FloatField()
    unit               = serializers.CharField()
    note               = serializers.CharField(allow_blank=True)
    bom_path           = serializers.CharField()


class BomCtbSerializer(serializers.Serializer):
    level            = serializers.IntegerField()
    root_part_no_rev = serializers.CharField()
    part_no_rev      = serializers.CharField()
    part_name        = serializers.CharField()
    bom_qty          = serializers.FloatField()
    unit             = serializers.CharField()
    need             = serializers.IntegerField()
    ohymv            = serializers.FloatField()
    wip              = serializers.FloatField()
    inv              = serializers.FloatField()
    ohnv             = serializers.FloatField()
    ctb              = serializers.CharField()
    bom_path         = serializers.CharField()
    note             = serializers.CharField(allow_blank=True)


class DemandSerializer(serializers.Serializer):
    Customer     = serializers.CharField()
    PO_Rel       = serializers.CharField(allow_blank=True)
    PO_Status    = serializers.CharField(allow_blank=True)
    Part_No_Rev  = serializers.CharField(allow_blank=True)
    Cust_Part    = serializers.CharField(allow_blank=True)
    Qty_Ready    = serializers.FloatField()
    Qty_WIP      = serializers.FloatField()
    Ship_Date    = serializers.CharField(allow_null=True)
    Due_Date     = serializers.CharField(allow_null=True)
    Rel_Qty      = serializers.FloatField()
    Shipped      = serializers.FloatField()
    Rel_Bal      = serializers.FloatField()
    Rel_Status   = serializers.CharField()
    Rel_Type     = serializers.CharField()