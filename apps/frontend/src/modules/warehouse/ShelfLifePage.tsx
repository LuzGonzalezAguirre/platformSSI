import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { Cell, Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import apiClient from "../../services/api.client";

type Status = "expired" | "expiring" | "ok" | "unknown";
type Container = {
  serial_no: string;
  part_key: string;
  part_no_revision: string;
  part_name: string;
  location: string;
  quantity: number;
  container_status: string | null;
  shelf_date: string | null;
  expired_date: string | null;
  days_remaining: number | null;
  status: Status;
};
type Report = {
  as_of: string;
  horizon_days: number;
  summary: { total: number; expired: number; expiring: number; ok: number; unknown: number; expired_pct: number; at_risk: number };
  containers: Container[];
};

const STATUS_COLORS: Record<Status, string> = { expired: "#fb6675", expiring: "#f4a83f", ok: "#39cc88", unknown: "#94a3b8" };
const panel: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 16, minWidth: 0 };
const control: React.CSSProperties = { background: "var(--color-surface)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px" };
const tableCell: React.CSSProperties = { padding: "11px 12px", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap", verticalAlign: "middle", textAlign: "left" };
const mono: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

export default function ShelfLifePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asOf, setAsOf] = useState(() => {
    const today = new Date();
    return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  });
  const [horizon, setHorizon] = useState(30);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const tr = (key: string) => t("warehouse.shelfLife." + key);
  const labels: Record<Status, string> = {
    expired: tr("expired"),
    expiring: tr("expiringSoon"),
    ok: tr("oK"),
    unknown: tr("unknown"),
  };

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get<Report>("/warehouse/shelf-life/", { params: { as_of: asOf, horizon } });
      setData(response.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : tr("unableToRetrievePlexInventory"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, [asOf, horizon]);

  const metrics = useMemo(() => {
    const items = data?.containers ?? [];
    const days = (min: number, max: number) => items.filter(x => x.days_remaining !== null && x.days_remaining >= min && x.days_remaining <= max).length;
    const windows = [
      { name: tr("bucketExpired"), count: days(-Infinity, -1), color: STATUS_COLORS.expired },
      { name: tr("bucket7"), count: days(0, 7), color: STATUS_COLORS.expiring },
      { name: tr("bucket15"), count: days(8, 15), color: "#eab65c" },
      { name: tr("bucket30"), count: days(16, 30), color: "#e5c17d" },
      { name: tr("bucket60"), count: days(31, 60), color: "#77a4db" },
      { name: tr("bucket90"), count: days(61, 90), color: "#7f9fca" },
      { name: tr("bucketLater"), count: days(91, Infinity), color: STATUS_COLORS.ok },
    ];
    const loc = new Map<string, { name: string; total: number; atRisk: number }>();
    for (const item of items) {
      const existing = loc.get(item.location) ?? { name: item.location, total: 0, atRisk: 0 };
      existing.total++;
      if (item.days_remaining !== null && item.days_remaining <= horizon) existing.atRisk++;
      loc.set(item.location, existing);
    }
    const locations = [...loc.values()].sort((a, b) => b.atRisk - a.atRisk || b.total - a.total).slice(0, 8);
    const upcoming = items.filter(x => x.days_remaining !== null && x.days_remaining >= 0)
      .sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0) || a.serial_no.localeCompare(b.serial_no)).slice(0, 5);
    const unknown = items.filter(x => x.days_remaining === null).length;
    return { windows, locations, upcoming, week: days(0, 7), quarter: days(0, 90), coverage: items.length ? (100 * (items.length - unknown) / items.length) : 0, unknown };
  }, [data, horizon, t]);

  const locations = useMemo(() => [...new Set(data?.containers.map(x => x.location) ?? [])].sort(), [data]);
  const rows = useMemo(() => (data?.containers ?? []).filter(x =>
    (!location || x.location === location) &&
    (!status || x.status === status) &&
    (!search || [x.serial_no, x.part_no_revision, x.part_name, x.location].some(v => (v ?? "").toLowerCase().includes(search.toLowerCase())))
  ), [data, location, status, search]);

  const kpi = (label: string, value: string, subtitle: string, color?: string) => (
    <div style={panel}>
      <span style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{label}</span>
      <div style={{ fontSize: 30, fontWeight: 750, color: color ?? "var(--color-text-primary)", marginTop: 5, ...mono }}>{value}</div>
      <small style={{ color: "var(--color-text-secondary)" }}>{subtitle}</small>
    </div>
  );
  const pieData = data ? (["expired", "expiring", "ok", "unknown"] as Status[]).map(key => ({ key, name: labels[key], value: data.summary[key] })) : [];

  return <div style={{ display: "grid", gap: 12, color: "var(--color-text-primary)" }}>
    <header style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <div>
        <h1 style={{ fontSize: 24, margin: 0 }}>{tr("wHShelfLifeExpiration")}</h1>
        <p style={{ color: "var(--color-text-secondary)", margin: "5px 0 0", fontSize: 13 }}>{tr("plexActiveContainersWithShelfLifeTJRWarehouseLocations")}</p>
      </div>
      <button type="button" style={{ ...control, display: "flex", alignItems: "center", gap: 6 }} disabled={loading} onClick={() => void refresh()}>
        <RefreshCw size={15} /> {loading ? tr("loading") : tr("refresh")}
      </button>
    </header>

    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>{tr("referenceDate")}:
        <input aria-label={tr("referenceDate")} type="date" value={asOf} onChange={e => setAsOf(e.target.value)} style={{ ...control, ...mono }} />
      </label>
      <div role="group" aria-label={tr("expirationWindow")} style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {[7, 15, 30, 60, 90].map(value => (
          <button type="button" key={value} onClick={() => setHorizon(value)} aria-pressed={horizon === value}
            style={{ ...control, background: horizon === value ? "var(--color-primary)" : "var(--color-surface)", color: horizon === value ? "#fff" : "var(--color-text-primary)" }}>
            {value} {tr("days")}
          </button>
        ))}
      </div>
    </div>
    {error && <div role="alert" style={{ ...panel, color: STATUS_COLORS.expired }}><AlertTriangle size={16} /> {t("warehouse.shelfLife.plexError", { detail: error })}</div>}
    {!data && loading && <p>{tr("loadingInventoryFromPlex")}</p>}

    {data && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(168px,1fr))", gap: 12 }}>
        {kpi(tr("expiredInventory"), data.summary.expired_pct.toFixed(2) + "%", tr("target0"), data.summary.expired ? STATUS_COLORS.expired : STATUS_COLORS.ok)}
        {kpi(tr("activeContainers"), String(data.summary.total), tr("shelfLifeControlled"))}
        {kpi(tr("expired"), String(data.summary.expired), tr("requireAction"), STATUS_COLORS.expired)}
        {kpi(tr("expiringSoon"), String(data.summary.expiring), t("warehouse.shelfLife.withinDays", { count: horizon }), STATUS_COLORS.expiring)}
        {kpi(tr("unknown"), String(data.summary.unknown), tr("missingExpirationData"), "#8ba5ca")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 12 }}>
        <section style={panel}>
          <h2 style={{ fontSize: 15, margin: 0 }}>{tr("shelfLifeDistribution")}</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "6px 0 12px" }}>{t("warehouse.shelfLife.distributionDescription", { count: data.summary.total })}</p>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div style={{ flex: "1 1 190px", minWidth: 180, height: 225, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={pieData.filter(x => x.value > 0)} dataKey="value" innerRadius="68%" outerRadius="91%" paddingAngle={1} stroke="none" isAnimationActive={false}>
                  {pieData.filter(x => x.value > 0).map(x => <Cell key={x.key} fill={STATUS_COLORS[x.key]} />)}
                </Pie><Tooltip formatter={value => [value ?? 0, tr("containersShort")]} /></PieChart>
              </ResponsiveContainer>
              <div style={{ pointerEvents: "none", position: "absolute", inset: 0, display: "grid", alignContent: "center", justifyItems: "center" }}>
                <strong style={{ fontSize: 28, ...mono }}>{data.summary.total}</strong><small style={{ color: "var(--color-text-secondary)" }}>{tr("containersShort")}</small>
              </div>
            </div>
            <div style={{ flex: "1 1 170px", display: "grid", gap: 13 }}>
              {pieData.map(x => <div key={x.key} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLORS[x.key] }} />
                <span style={{ flex: 1 }}>{x.name}</span><strong style={mono}>{x.value}</strong>
              </div>)}
            </div>
          </div>
        </section>
        <section style={panel}>
          <h2 style={{ fontSize: 15, margin: 0 }}>{tr("expirationBuckets")}</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "6px 0 12px" }}>{tr("timelineDescription")}</p>
          <div style={{ height: 295 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.windows} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 10 }}>
                <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.6} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                <Tooltip formatter={value => [value ?? 0, tr("containersShort")]} />
                <Bar dataKey="count" name={tr("containersShort")} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {metrics.windows.map(x => <Cell key={x.name} fill={x.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 12 }}>
        <section style={panel}>
          <h2 style={{ fontSize: 15, margin: 0 }}>{tr("locationConcentration")}</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "6px 0 12px" }}>{tr("locationChartDescription")}</p>
          <div style={{ height: 265 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.locations} margin={{ top: 8, right: 8, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="atRisk" name={tr("expiringSoon")} fill={STATUS_COLORS.expiring} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="total" name={tr("totalByLocation")} fill="#83a7d4" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section style={panel}>
          <h2 style={{ fontSize: 15, margin: 0 }}>{tr("upcomingExpirations")}</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "6px 0 12px" }}>{tr("upcomingDescription")}</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{[tr("serialNo"), tr("location"), tr("expiration"), tr("daysLeft")].map(x => <th key={x} style={{ ...tableCell, color: "var(--color-text-secondary)" }}>{x}</th>)}</tr></thead>
              <tbody>{metrics.upcoming.map(x => <tr key={x.serial_no}>
                <td style={{ ...tableCell, fontWeight: 650 }}>{x.serial_no}</td>
                <td style={tableCell}>{x.location}</td>
                <td style={{ ...tableCell, ...mono }}>{x.expired_date}</td>
                <td style={{ ...tableCell, textAlign: "right" }}><span style={{ border: "1px solid " + (x.days_remaining !== null && x.days_remaining <= 30 ? STATUS_COLORS.expiring : "#83a7d4"), borderRadius: 20, padding: "3px 7px", ...mono }}>{x.days_remaining} {tr("dayAbbr")}</span></td>
              </tr>)}</tbody>
            </table>
            {metrics.upcoming.length === 0 && <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{tr("noUpcoming")}</p>}
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12 }}>
        {kpi(tr("expiring7"), String(metrics.week), tr("immediateAttention"), STATUS_COLORS.expiring)}
        {kpi(tr("expiring90"), String(metrics.quarter), tr("planConsumption"), "#83a7d4")}
        {kpi(tr("coverage"), metrics.coverage.toFixed(0) + "%", tr("knownExpiration"), STATUS_COLORS.ok)}
        {kpi(tr("unknown"), String(metrics.unknown), tr("missingExpirationData"), "#83a7d4")}
      </div>

      <section style={panel} id="shelf-life-details">
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>{tr("containerDetails")} <small style={{ fontWeight: 400 }}>({rows.length})</small></h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <label style={{ ...control, display: "flex", gap: 6, alignItems: "center" }}>
            <Search size={16} />
            <input aria-label={tr("searchContainerOrPart")} placeholder={tr("serialPartKeyLocation")} value={search} onChange={e => setSearch(e.target.value)} style={{ background: "transparent", border: 0, outline: "none", color: "inherit", minWidth: 200 }} />
          </label>
          <select aria-label={tr("locationFilter")} style={control} value={location} onChange={e => setLocation(e.target.value)}>
            <option value="">{tr("allLocations")}</option>{locations.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select aria-label={tr("statusFilter")} style={control} value={status} onChange={e => setStatus(e.target.value as Status | "")}>
            <option value="">{tr("allStatuses")}</option>{(["expired", "expiring", "ok", "unknown"] as Status[]).map(x => <option key={x} value={x}>{labels[x]}</option>)}
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 990, tableLayout: "fixed", borderCollapse: "collapse", fontSize: 12 }}>
            <colgroup><col style={{ width: "12%" }} /><col style={{ width: "22%" }} /><col style={{ width: "12%" }} /><col style={{ width: "7%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "9%" }} /><col style={{ width: "14%" }} /></colgroup>
            <thead><tr>{[tr("serialNo"), tr("partNumberRevision"), tr("location"), tr("qty"), tr("shelfDate"), tr("expiration"), tr("daysLeft"), tr("status")].map((x, i) =>
              <th key={i} scope="col" style={{ ...tableCell, textAlign: i === 3 || i === 6 ? "right" : "left" }}>{x}</th>
            )}</tr></thead>
            <tbody>{rows.map(x => <tr key={x.serial_no} onClick={() => setExpanded(expanded === x.serial_no ? null : x.serial_no)} style={{ cursor: "pointer", background: expanded === x.serial_no ? "var(--color-bg)" : undefined }}>
              <td style={{ ...tableCell, ...mono }}>{x.serial_no}</td>
              <td style={{ ...tableCell, ...mono, overflow: "hidden", textOverflow: "ellipsis" }} title={x.part_name ? x.part_no_revision + " · " + x.part_name : x.part_no_revision}>{x.part_no_revision}</td>
              <td style={tableCell}>{x.location}</td>
              <td style={{ ...tableCell, ...mono, textAlign: "right" }}>{x.quantity}</td>
              <td style={{ ...tableCell, ...mono }}>{x.shelf_date ?? "—"}</td>
              <td style={{ ...tableCell, ...mono }}>{x.expired_date ?? "—"}</td>
              <td style={{ ...tableCell, ...mono, textAlign: "right" }}>{x.days_remaining ?? "—"}</td>
              <td style={tableCell}><strong style={{ color: STATUS_COLORS[x.status] }}>{labels[x.status]}</strong>{expanded === x.serial_no && <div style={{ marginTop: 4, color: "var(--color-text-secondary)", fontSize: 11 }}>{tr("plexStatus")} {x.container_status ?? "—"}{x.part_name && <div>{x.part_name}</div>}</div>}</td>
            </tr>)}</tbody>
          </table>
          {rows.length === 0 && <p style={{ fontSize: 13 }}>{tr("noMatchingContainers")}</p>}
        </div>
      </section>
    </>}
  </div>;
}
