import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Users, Plus, Save, RefreshCw, Pencil, PowerOff, Eye, EyeOff } from "lucide-react";
import { AssistanceService } from "./assistance.service";
import {
  PlantEmployee, AttendanceRecord,
  AttendanceStatus, AttendanceShift,
  PlantEmployeeCreatePayload,
  DEPARTMENTS, STATUS_LABELS, STATUS_COLORS,
  SHIFT_LABELS, DEFAULT_HOURS,
} from "./types";

type Tab = "attendance" | "employees";

interface EditModal {
  open: boolean;
  employee: PlantEmployee | null;
  draft: { name: string; department: string; turno: "A" | "B" };
  saving: boolean;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function AssistancePage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const [activeTab, setActiveTab]       = useState<Tab>("attendance");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [turnoFilter, setTurnoFilter]   = useState<"" | "A" | "B">("");

  // Attendance
  const [records, setRecords]     = useState<AttendanceRecord[]>([]);
  const [draft, setDraft]         = useState<AttendanceRecord[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [savingAtt, setSavingAtt]   = useState(false);
  const [attMsg, setAttMsg]         = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Employees
  const [employees, setEmployees]         = useState<PlantEmployee[]>([]);
  const [loadingEmp, setLoadingEmp]       = useState(false);
  const [empFilter, setEmpFilter]         = useState<"" | "A" | "B">("");
  const [empSearch, setEmpSearch]         = useState("");
  const [showInactive, setShowInactive]   = useState(false);
  const [showAddForm, setShowAddForm]     = useState(false);
  const [newEmp, setNewEmp]               = useState<PlantEmployeeCreatePayload>({
    name: "", department: "Assembly", turno: "A",
  });
  const [addingEmp, setAddingEmp]   = useState(false);
  const [empMsg, setEmpMsg]         = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // Edit modal
  const [editModal, setEditModal] = useState<EditModal>({
    open: false, employee: null,
    draft: { name: "", department: "Assembly", turno: "A" },
    saving: false,
  });

  const isEditable = useCallback(() => {
    const today = new Date();
    const sel   = new Date(selectedDate + "T12:00:00");
    return Math.floor((today.getTime() - sel.getTime()) / 86400000) <= 7;
  }, [selectedDate]);

  const loadAttendance = useCallback(async () => {
    setLoadingAtt(true);
    setError(null);
    try {
      const data = await AssistanceService.getAttendance(
        selectedDate, turnoFilter || undefined,
      );
      setRecords(data);
      setDraft(data.map((r) => ({ ...r })));
    } catch {
      setError(lang === "es" ? "Error cargando asistencia" : "Error loading attendance");
    } finally {
      setLoadingAtt(false);
    }
  }, [selectedDate, turnoFilter, lang]);

  const loadEmployees = useCallback(async () => {
    setLoadingEmp(true);
    try {
      const data = await AssistanceService.listEmployees(undefined, showInactive);
      setEmployees(data);
    } catch {
      setError(lang === "es" ? "Error cargando empleados" : "Error loading employees");
    } finally {
      setLoadingEmp(false);
    }
  }, [lang, showInactive]);

  useEffect(() => {
    if (activeTab === "attendance") loadAttendance();
    else loadEmployees();
  }, [activeTab, loadAttendance, loadEmployees]);

  const updateDraftRow = (idx: number, field: keyof AttendanceRecord, value: string | number) => {
    setDraft((prev) => {
      const next = [...prev];
      const row  = { ...next[idx], [field]: value };
      if (field === "status" && value === "absent") {
        row.hours = "0"; row.shift = "none";
      }
      if (field === "shift") {
        const h = DEFAULT_HOURS[value as AttendanceShift];
        if (row.status !== "absent") row.hours = String(h);
      }
      next[idx] = row;
      return next;
    });
  };

  const saveAttendance = async () => {
    setSavingAtt(true); setAttMsg(null);
    try {
      const result = await AssistanceService.saveAttendance({
        records: draft.map((r) => ({
          employee_id: r.employee_id,
          date:        r.date,
          status:      r.status,
          shift:       r.shift,
          hours:       parseFloat(r.hours) || 0,
        })),
      });
      setAttMsg({
        type: "success",
        text: lang === "es"
          ? `${result.saved} registros guardados`
          : `${result.saved} records saved`,
      });
      loadAttendance();
    } catch {
      setAttMsg({ type: "error", text: lang === "es" ? "Error guardando" : "Error saving" });
    } finally {
      setSavingAtt(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmp.name.trim()) {
      setEmpMsg({ type: "error", text: lang === "es" ? "El nombre es obligatorio" : "Name is required" });
      return;
    }
    setAddingEmp(true); setEmpMsg(null);
    try {
      await AssistanceService.createEmployee(newEmp);
      setEmpMsg({
        type: "success",
        text: lang === "es" ? `'${newEmp.name}' agregado` : `'${newEmp.name}' added`,
      });
      setNewEmp({ name: "", department: "Assembly", turno: "A" });
      setShowAddForm(false);
      loadEmployees();
    } catch {
      setEmpMsg({ type: "error", text: lang === "es" ? "Error agregando" : "Error adding" });
    } finally {
      setAddingEmp(false);
    }
  };

  const openEditModal = (emp: PlantEmployee) => {
    setEditModal({
      open: true,
      employee: emp,
      draft: { name: emp.name, department: emp.department, turno: emp.turno },
      saving: false,
    });
  };

  const handleEditSave = async () => {
    if (!editModal.employee) return;
    setEditModal((p) => ({ ...p, saving: true }));
    try {
      const updated = await AssistanceService.updateEmployee(
        editModal.employee.id, editModal.draft,
      );
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditModal({ open: false, employee: null, draft: { name: "", department: "Assembly", turno: "A" }, saving: false });
      setEmpMsg({ type: "success", text: lang === "es" ? "Empleado actualizado" : "Employee updated" });
    } catch {
      setEditModal((p) => ({ ...p, saving: false }));
      setEmpMsg({ type: "error", text: lang === "es" ? "Error actualizando" : "Error updating" });
    }
  };

  const handleDeactivate = async (emp: PlantEmployee) => {
    try {
      const updated = await AssistanceService.deactivateEmployee(emp.id);
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEmpMsg({
        type: "success",
        text: lang === "es"
          ? `'${emp.name}' desactivado`
          : `'${emp.name}' deactivated`,
      });
    } catch {
      setEmpMsg({ type: "error", text: lang === "es" ? "Error desactivando" : "Error deactivating" });
    }
  };

  // Stats
  const total      = draft.length;
  const present    = draft.filter((r) => r.status === "present").length;
  const absent     = draft.filter((r) => r.status === "absent").length;
  const totalHours = draft.reduce((acc, r) => acc + (parseFloat(r.hours) || 0), 0);

  const filteredEmployees = employees.filter((e) => {
    const matchTurno  = empFilter ? e.turno === empFilter : true;
    const matchSearch = empSearch
      ? e.name.toLowerCase().includes(empSearch.toLowerCase())
      : true;
    return matchTurno && matchSearch;
  });

  const activeCount   = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.filter((e) => !e.is_active).length;
  const turnoACount   = employees.filter((e) => e.turno === "A" && e.is_active).length;
  const turnoBCount   = employees.filter((e) => e.turno === "B" && e.is_active).length;

  const editable = isEditable();
  const s = styles;

  const TABS = [
    { key: "attendance" as Tab, label: { es: "Asistencia", en: "Attendance" } },
    { key: "employees"  as Tab, label: { es: "Empleados",  en: "Employees"  } },
  ];

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.title}>{lang === "es" ? "Asistencia" : "Assistance"}</h1>
          <p style={s.subtitle}>
            {lang === "es"
              ? "Control de asistencia y gestión de empleados de planta"
              : "Attendance tracking and plant employee management"}
          </p>
        </div>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      <div style={s.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={{ ...s.tabBtn, ...(activeTab === tab.key ? s.tabBtnActive : {}) }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label[lang]}
          </button>
        ))}
      </div>

      {/* ── ATTENDANCE TAB ── */}
      {activeTab === "attendance" && (
        <div style={s.section}>
          <div style={s.attControls}>
            <div style={s.controlGroup}>
              <label style={s.fieldLabel}>{lang === "es" ? "Fecha:" : "Date:"}</label>
              <input
                type="date" value={selectedDate} max={todayStr()}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={s.dateInput}
              />
            </div>
            <div style={s.controlGroup}>
              <label style={s.fieldLabel}>Turno:</label>
              <select
                value={turnoFilter}
                onChange={(e) => setTurnoFilter(e.target.value as "" | "A" | "B")}
                style={s.selectInput}
              >
                <option value="">{lang === "es" ? "Todos" : "All"}</option>
                <option value="A">Turno A</option>
                <option value="B">Turno B</option>
              </select>
            </div>
            {editable && (
              <button style={s.saveBtn} onClick={saveAttendance} disabled={savingAtt}>
                {savingAtt ? <RefreshCw size={14} /> : <Save size={14} />}
                <span>{savingAtt
                  ? (lang === "es" ? "Guardando..." : "Saving...")
                  : (lang === "es" ? "Guardar Asistencia" : "Save Attendance")}
                </span>
              </button>
            )}
          </div>

          <div style={s.statsRow}>
            <div style={s.statCard}>
              <div style={s.statValue}>{total}</div>
              <div style={s.statLabel}>{lang === "es" ? "Total" : "Total"}</div>
            </div>
            <div style={s.statCard}>
              <div style={{ ...s.statValue, color: "#10b981" }}>{present}</div>
              <div style={s.statLabel}>{lang === "es" ? "Presentes" : "Present"}</div>
            </div>
            <div style={s.statCard}>
              <div style={{ ...s.statValue, color: "#ef4444" }}>{absent}</div>
              <div style={s.statLabel}>{lang === "es" ? "Ausentes" : "Absent"}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statValue}>{totalHours.toFixed(1)}</div>
              <div style={s.statLabel}>{lang === "es" ? "Horas totales" : "Total Hours"}</div>
            </div>
          </div>

          {!editable && (
            <div style={s.readOnlyBanner}>
              {lang === "es"
                ? "Modo lectura — solo se pueden editar los últimos 7 días"
                : "Read-only — only the last 7 days can be edited"}
            </div>
          )}

          {attMsg && (
            <div style={{
              ...s.msgBanner,
              background: attMsg.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.08)",
              color:      attMsg.type === "success" ? "#10b981" : "#ef4444",
              border:     `1px solid ${attMsg.type === "success" ? "rgba(16,185,129,0.2)" : "rgba(220,38,38,0.2)"}`,
            }}>
              {attMsg.text}
            </div>
          )}

          {loadingAtt ? (
            <div style={s.loadingState}>{lang === "es" ? "Cargando..." : "Loading..."}</div>
          ) : draft.length === 0 ? (
            <div style={s.emptyState}>
              <Users size={36} color="var(--color-text-tertiary)" />
              <p>{lang === "es" ? "Sin empleados registrados" : "No employees registered"}</p>
            </div>
          ) : (
            <div style={s.tableWrapper}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>{lang === "es" ? "Empleado" : "Employee"}</th>
                    <th style={{ ...s.th, textAlign: "center" }}>Turno</th>
                    <th style={{ ...s.th, textAlign: "center" }}>{lang === "es" ? "Estado" : "Status"}</th>
                    <th style={{ ...s.th, textAlign: "center" }}>{lang === "es" ? "Turno" : "Shift"}</th>
                    <th style={{ ...s.th, textAlign: "center" }}>{lang === "es" ? "Horas" : "Hours"}</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.map((row, idx) => (
                    <tr key={row.employee_id} style={idx % 2 === 0 ? s.trEven : s.trOdd}>
                      <td style={s.td}>{row.employee_name}</td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <span style={{
                          ...s.turnoBadge,
                          background: row.turno === "A" ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)",
                          color: row.turno === "A" ? "var(--color-primary)" : "#d97706",
                        }}>
                          {row.turno}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        {editable ? (
                          <select
                            value={row.status}
                            onChange={(e) => updateDraftRow(idx, "status", e.target.value)}
                            style={{ ...s.cellSelect, color: STATUS_COLORS[row.status], borderColor: `${STATUS_COLORS[row.status]}40` }}
                          >
                            {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((k) => (
                              <option key={k} value={k}>{STATUS_LABELS[k][lang]}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: STATUS_COLORS[row.status], fontWeight: 600, fontSize: "0.8125rem" }}>
                            {STATUS_LABELS[row.status][lang]}
                          </span>
                        )}
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        {editable ? (
                          <select
                            value={row.shift}
                            onChange={(e) => updateDraftRow(idx, "shift", e.target.value)}
                            style={s.cellSelect}
                            disabled={row.status === "absent"}
                          >
                            {(Object.keys(SHIFT_LABELS) as AttendanceShift[]).map((k) => (
                              <option key={k} value={k}>{SHIFT_LABELS[k][lang]}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                            {SHIFT_LABELS[row.shift][lang]}
                          </span>
                        )}
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        {editable ? (
                          <input
                            type="number" min={0} max={24} step={0.5}
                            value={row.hours}
                            onChange={(e) => updateDraftRow(idx, "hours", e.target.value)}
                            disabled={row.status === "absent"}
                            style={s.hoursInput}
                          />
                        ) : (
                          <span style={{ fontSize: "0.8125rem" }}>{row.hours}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── EMPLOYEES TAB ── */}
      {activeTab === "employees" && (
        <div style={s.section}>
          <div style={s.statsRow}>
            <div style={s.statCard}>
              <div style={s.statValue}>{activeCount}</div>
              <div style={s.statLabel}>{lang === "es" ? "Activos" : "Active"}</div>
            </div>
            <div style={s.statCard}>
              <div style={{ ...s.statValue, color: "var(--color-primary)" }}>{turnoACount}</div>
              <div style={s.statLabel}>Turno A</div>
            </div>
            <div style={s.statCard}>
              <div style={{ ...s.statValue, color: "#d97706" }}>{turnoBCount}</div>
              <div style={s.statLabel}>Turno B</div>
            </div>
            {showInactive && (
              <div style={s.statCard}>
                <div style={{ ...s.statValue, color: "var(--color-text-tertiary)" }}>{inactiveCount}</div>
                <div style={s.statLabel}>{lang === "es" ? "Inactivos" : "Inactive"}</div>
              </div>
            )}
          </div>

          <div style={s.empControls}>
            <input
              type="text"
              placeholder={lang === "es" ? "Buscar por nombre..." : "Search by name..."}
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              style={{ ...s.dateInput, minWidth: "200px" }}
            />
            <select
              value={empFilter}
              onChange={(e) => setEmpFilter(e.target.value as "" | "A" | "B")}
              style={s.selectInput}
            >
              <option value="">{lang === "es" ? "Todos los turnos" : "All shifts"}</option>
              <option value="A">Turno A</option>
              <option value="B">Turno B</option>
            </select>
            <button
              style={s.toggleInactiveBtn}
              onClick={() => setShowInactive((p) => !p)}
            >
              {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
              {showInactive
                ? (lang === "es" ? "Ocultar inactivos" : "Hide inactive")
                : (lang === "es" ? "Mostrar inactivos" : "Show inactive")}
            </button>
            <button style={s.addBtn} onClick={() => setShowAddForm((p) => !p)}>
              <Plus size={15} />
              {lang === "es" ? "Agregar Empleado" : "Add Employee"}
            </button>
          </div>

          {showAddForm && (
            <div style={s.addForm}>
              <div style={s.addFormTitle}>
                {lang === "es" ? "Nuevo Empleado" : "New Employee"}
              </div>
              <div style={s.addFormGrid}>
                <div style={s.fieldGroup}>
                  <label style={s.fieldLabel}>
                    {lang === "es" ? "Nombre completo" : "Full name"} *
                  </label>
                  <input
                    type="text" value={newEmp.name}
                    onChange={(e) => setNewEmp((p) => ({ ...p, name: e.target.value }))}
                    style={s.input}
                    placeholder={lang === "es" ? "Nombre del operador" : "Operator name"}
                  />
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.fieldLabel}>{lang === "es" ? "Departamento" : "Department"}</label>
                  <select
                    value={newEmp.department}
                    onChange={(e) => setNewEmp((p) => ({ ...p, department: e.target.value }))}
                    style={s.input}
                  >
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.fieldLabel}>Turno *</label>
                  <select
                    value={newEmp.turno}
                    onChange={(e) => setNewEmp((p) => ({ ...p, turno: e.target.value as "A" | "B" }))}
                    style={s.input}
                  >
                    <option value="A">Turno A</option>
                    <option value="B">Turno B</option>
                  </select>
                </div>
              </div>
              <div style={s.addFormActions}>
                <button style={s.saveBtn} onClick={handleAddEmployee} disabled={addingEmp}>
                  {addingEmp
                    ? (lang === "es" ? "Agregando..." : "Adding...")
                    : (lang === "es" ? "Guardar" : "Save")}
                </button>
                <button style={s.cancelBtn} onClick={() => setShowAddForm(false)}>
                  {lang === "es" ? "Cancelar" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {empMsg && (
            <div style={{
              ...s.msgBanner,
              background: empMsg.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.08)",
              color:      empMsg.type === "success" ? "#10b981" : "#ef4444",
              border:     `1px solid ${empMsg.type === "success" ? "rgba(16,185,129,0.2)" : "rgba(220,38,38,0.2)"}`,
            }}>
              {empMsg.text}
            </div>
          )}

          {loadingEmp ? (
            <div style={s.loadingState}>{lang === "es" ? "Cargando..." : "Loading..."}</div>
          ) : filteredEmployees.length === 0 ? (
            <div style={s.emptyState}>
              <Users size={36} color="var(--color-text-tertiary)" />
              <p>{lang === "es" ? "Sin empleados" : "No employees"}</p>
            </div>
          ) : (
            <div style={s.tableWrapper}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>{lang === "es" ? "Nombre" : "Name"}</th>
                    <th style={{ ...s.th, textAlign: "center" }}>Turno</th>
                    <th style={{ ...s.th, textAlign: "center" }}>{lang === "es" ? "Departamento" : "Department"}</th>
                    <th style={{ ...s.th, textAlign: "center" }}>{lang === "es" ? "Estado" : "Status"}</th>
                    <th style={{ ...s.th, textAlign: "center" }}>{lang === "es" ? "Acciones" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, idx) => (
                    <tr
                      key={emp.id}
                      style={{
                        ...(idx % 2 === 0 ? s.trEven : s.trOdd),
                        opacity: emp.is_active ? 1 : 0.5,
                      }}
                    >
                      <td style={s.td}>{emp.name}</td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <span style={{
                          ...s.turnoBadge,
                          background: emp.turno === "A" ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)",
                          color: emp.turno === "A" ? "var(--color-primary)" : "#d97706",
                        }}>
                          {emp.turno}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.8125rem" }}>
                        {emp.department}
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 600,
                          padding: "0.2rem 0.5rem",
                          borderRadius: "var(--radius-full, 9999px)",
                          background: emp.is_active ? "rgba(16,185,129,0.1)" : "rgba(100,100,100,0.1)",
                          color: emp.is_active ? "#10b981" : "var(--color-text-tertiary)",
                        }}>
                          {emp.is_active
                            ? (lang === "es" ? "Activo" : "Active")
                            : (lang === "es" ? "Inactivo" : "Inactive")}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <div style={s.actionBtns}>
                          <button
                            style={s.iconBtn}
                            onClick={() => openEditModal(emp)}
                            title={lang === "es" ? "Editar" : "Edit"}
                          >
                            <Pencil size={14} />
                          </button>
                          {emp.is_active && (
                            <button
                              style={{ ...s.iconBtn, color: "#ef4444" }}
                              onClick={() => handleDeactivate(emp)}
                              title={lang === "es" ? "Desactivar" : "Deactivate"}
                            >
                              <PowerOff size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editModal.open && (
        <div style={s.modalOverlay} onClick={() => setEditModal((p) => ({ ...p, open: false }))}>
          <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>
                {lang === "es" ? "Editar Empleado" : "Edit Employee"}
              </span>
              <button
                style={s.modalClose}
                onClick={() => setEditModal((p) => ({ ...p, open: false }))}
              >
                ✕
              </button>
            </div>

            <div style={s.modalBody}>
              <div style={s.fieldGroup}>
                <label style={s.fieldLabel}>
                  {lang === "es" ? "Nombre completo" : "Full name"} *
                </label>
                <input
                  type="text"
                  value={editModal.draft.name}
                  onChange={(e) => setEditModal((p) => ({ ...p, draft: { ...p.draft, name: e.target.value } }))}
                  style={s.input}
                />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.fieldLabel}>
                  {lang === "es" ? "Departamento" : "Department"}
                </label>
                <select
                  value={editModal.draft.department}
                  onChange={(e) => setEditModal((p) => ({ ...p, draft: { ...p.draft, department: e.target.value } }))}
                  style={s.input}
                >
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.fieldLabel}>Turno</label>
                <select
                  value={editModal.draft.turno}
                  onChange={(e) => setEditModal((p) => ({ ...p, draft: { ...p.draft, turno: e.target.value as "A" | "B" } }))}
                  style={s.input}
                >
                  <option value="A">Turno A</option>
                  <option value="B">Turno B</option>
                </select>
              </div>
            </div>

            <div style={s.modalFooter}>
              <button
                style={s.cancelBtn}
                onClick={() => setEditModal((p) => ({ ...p, open: false }))}
              >
                {lang === "es" ? "Cancelar" : "Cancel"}
              </button>
              <button
                style={s.saveBtn}
                onClick={handleEditSave}
                disabled={editModal.saving}
              >
                {editModal.saving
                  ? (lang === "es" ? "Guardando..." : "Saving...")
                  : (lang === "es" ? "Guardar" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:             { display: "flex", flexDirection: "column", gap: "1.25rem" },
  pageHeader:       { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title:            { fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 },
  subtitle:         { fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  errorBanner:      { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", background: "rgba(220,38,38,0.08)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.875rem" },
  tabBar:           { display: "flex", gap: "0.25rem", borderBottom: "2px solid var(--color-border)" },
  tabBtn:           { padding: "0.625rem 1.25rem", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text-secondary)", borderBottom: "2px solid transparent", marginBottom: "-2px" },
  tabBtnActive:     { color: "var(--color-primary)", borderBottomColor: "var(--color-primary)", fontWeight: 600 },
  section:          { display: "flex", flexDirection: "column", gap: "1rem" },
  attControls:      { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  empControls:      { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  controlGroup:     { display: "flex", alignItems: "center", gap: "0.5rem" },
  fieldLabel:       { fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" },
  dateInput:        { padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" },
  selectInput:      { padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" },
  saveBtn:          { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 1rem", borderRadius: "var(--radius-md)", background: "var(--color-primary)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 },
  addBtn:           { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 1rem", borderRadius: "var(--radius-md)", background: "var(--color-primary)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 },
  toggleInactiveBtn:{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500 },
  cancelBtn:        { padding: "0.4rem 1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.8125rem" },
  statsRow:         { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  statCard:         { padding: "0.875rem 1.25rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "100px" },
  statValue:        { fontSize: "1.75rem", fontWeight: 800, color: "var(--color-text-primary)" },
  statLabel:        { fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 500 },
  readOnlyBanner:   { padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", background: "rgba(100,100,100,0.08)", color: "var(--color-text-secondary)", fontSize: "0.8125rem", border: "1px solid var(--color-border)" },
  msgBanner:        { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", fontSize: "0.875rem" },
  loadingState:     { color: "var(--color-text-secondary)", padding: "2rem", textAlign: "center" },
  emptyState:       { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "3rem", color: "var(--color-text-tertiary)" },
  tableWrapper:     { overflowX: "auto" as const, borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" },
  table:            { width: "100%", borderCollapse: "collapse" as const },
  th:               { padding: "0.75rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.04em", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" },
  td:               { padding: "0.625rem 1rem", fontSize: "0.875rem", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border)" },
  trEven:           { background: "var(--color-surface)" },
  trOdd:            { background: "var(--color-surface-raised, var(--color-surface))" },
  cellSelect:       { padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-primary)" },
  hoursInput:       { width: "64px", padding: "0.25rem 0.375rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.8125rem", textAlign: "center" as const },
  turnoBadge:       { fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "var(--radius-full, 9999px)" },
  actionBtns:       { display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" },
  iconBtn:          { background: "transparent", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "0.375rem", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center" },
  addForm:          { padding: "1.25rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "1rem" },
  addFormTitle:     { fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-text-primary)" },
  addFormGrid:      { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" },
  addFormActions:   { display: "flex", gap: "0.75rem" },
  fieldGroup:       { display: "flex", flexDirection: "column", gap: "0.375rem" },
  input:            { padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem", width: "100%", boxSizing: "border-box" as const },
  modalOverlay:     { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox:         { background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column" },
  modalHeader:      { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: "1px solid var(--color-border)" },
  modalTitle:       { fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" },
  modalClose:       { background: "transparent", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--color-text-secondary)" },
  modalBody:        { padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" },
  modalFooter:      { display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.25rem", borderTop: "1px solid var(--color-border)" },
};