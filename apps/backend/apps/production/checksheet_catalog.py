"""Explicitly verified WC checksheet groups for the pilot monitor.

This is not a complete plant inventory. Add WCs only after confirming their
Part, Control Plan, ordered sections and Responsibility in Plex. A plan is
part-specific; it must not be assumed current indefinitely.
"""
CHECKSHEET_WORKCENTERS = (
    {
        "area_key": "VOLVO",
        "area_name": "Volvo",
        "workcenter_key": 75408,
        "workcenter_name": "HM Ensamble Final 2",
        "part_key": 4573943,
        "part_no_rev": "43301.3 Rev:2",
        "control_plan_key": 446576,
        "configuration_scope": "VALIDATED_PILOT_NOT_DYNAMIC_CURRENT_JOB",
        "groups": (
            {
                "group_key": "MACHINE_QUALIFICATION",
                "name": "Calificación de la máquina",
                "department": "UNASSIGNED",
                "freshness_only": True,
                "section_ids": (2345859, 2345863, 2345862, 2345866, 2345872, 2345874, 2345877, 2345883, 2345882, 2345886, 2345891, 2345895),
                "operation_numbers": (820, 830, 835, 840, 845, 850, 855, 860, 865, 870, 880, 885),
            },
            {
                "group_key": "PRODUCTION_SHIFT_START",
                "name": "Inicio turno / Cambio turno / Cambio modelo",
                "department": "PRODUCTION",
                "freshness_only": True,
                "section_ids": (2345865, 2345867, 2345869, 2530352, 2345870, 2345875, 2345879, 2345881, 2345885, 2345889, 2345893, 2345905, 2345897, 2345900, 2345910),
                "operation_numbers": (835, 840, 845, 847, 850, 855, 860, 865, 870, 875, 880, 885, 890, 895, 905),
            },
            {
                "group_key": "PRODUCTION_PERIODIC_120",
                "name": "Inicio turno / Cambio turno / Cambio modelo / 2 Hrs",
                "department": "PRODUCTION",
                "interval_minutes": 120,
                "section_ids": (2345913, 2345914, 2345915, 2345916, 2345917),
                "operation_numbers": (820, 830, 860, 875, 895),
            },
        ),
    },
)


def catalog():
    return [
        {
            **{key: value for key, value in wc.items() if key != "groups"},
            "groups": [
                {**group, "section_ids": list(group["section_ids"]),
                 "operation_numbers": list(group["operation_numbers"])}
                for group in wc["groups"]
            ],
        }
        for wc in CHECKSHEET_WORKCENTERS
    ]


def summarize_monitor(rows):
    """Aggregate group evidence conservatively; never infer current compliance.

    Multiple groups/departments can be added later. An unconfigured department
    is NOT considered completed or even evaluated.
    """
    areas = {}
    for row in rows:
        area = areas.setdefault(row["area_key"], {
            "area_key": row["area_key"], "area_name": row["area_name"],
            "workcenters": [],
        })
        department_results = {}
        for group in row["groups"]:
            department = group["department"]
            entry = department_results.setdefault(department, {
                "department": department,
                "status": "UNVERIFIED",
                "groups": [],
            })
            entry["groups"].append(group)
        area["workcenters"].append({
            **{key: row[key] for key in (
                "workcenter_key", "workcenter_name", "part_key",
                "part_no_rev", "control_plan_key", "configuration_scope")},
            "status": "UNVERIFIED",
            "department_results": list(department_results.values()),
            "departments_not_evaluated": [
                dept for dept in ("PRODUCTION", "QUALITY")
                if dept not in department_results
            ],
        })
    return {
        "areas": list(areas.values()),
        "workcenters_returned": len(rows),
        "current_plex_status_verified": False,
        "teams_notifications_enabled": False,
    }
