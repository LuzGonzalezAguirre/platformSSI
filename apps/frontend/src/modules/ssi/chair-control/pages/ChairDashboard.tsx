import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { chairApi, type ChairFilters } from "../api/chairApi";
import { KPICards } from "../components/KPICards";
import { FiltersBar } from "../components/FiltersBar";
import { ChartsSection } from "../components/ChartsSection";
import { BreaksTable } from "../components/BreaksTable";

const today = new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

const DEFAULT_FILTERS: ChairFilters = {
  start_date: thirtyDaysAgo,
  end_date: today,
};

export default function ChairDashboard() {
  const [filters, setFilters] = useState<ChairFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState("check_in");
  const [orderDir, setOrderDir] = useState<"ASC" | "DESC">("DESC");
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: kpis, isLoading: kpiLoading } = useQuery({
    queryKey: ["chair-kpis", filters],
    queryFn: () => chairApi.getKpis(filters),
  });

  const { data: breaks, isLoading: breaksLoading } = useQuery({
    queryKey: ["chair-breaks", filters, page, search, orderBy, orderDir],
    queryFn: () =>
      chairApi.getBreaks({ ...filters, search, page, page_size: 20, order_by: orderBy, order_dir: orderDir }),
  });

  const { data: dailyChart, isLoading: dailyLoading } = useQuery({
    queryKey: ["chair-daily", filters],
    queryFn: () => chairApi.getDailyChart(filters),
  });

  const { data: turnoChart, isLoading: turnoLoading } = useQuery({
    queryKey: ["chair-turno", filters],
    queryFn: () => chairApi.getTurnoChart(filters),
  });

  const handleFiltersChange = (f: ChairFilters) => {
    setFilters(f);
    setPage(1);
    setSearch("");
  };

  const handleSort = (col: string) => {
    if (col === orderBy) {
      setOrderDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    } else {
      setOrderBy(col);
      setOrderDir("DESC");
    }
    setPage(1);
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await chairApi.downloadPdf(filters);
    } catch {
      alert("Error al generar el PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px 28px", background: "#f5f7fb", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
            Control de Sillas — Ley Silla NOM-036
          </h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>
            Monitoreo de descansos de empleados de producción
          </p>
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          style={{
            background: pdfLoading ? "#999" : "#0070C0",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: pdfLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {pdfLoading ? "Generando..." : "⬇ Generar Reporte PDF"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Filters */}
        <FiltersBar filters={filters} onChange={handleFiltersChange} />

        {/* KPIs */}
        <KPICards data={kpis} loading={kpiLoading} />

        {/* Charts */}
        <ChartsSection
          dailyData={dailyChart ?? []}
          turnoData={turnoChart ?? []}
          loadingDaily={dailyLoading}
          loadingTurno={turnoLoading}
        />

        {/* Table */}
        <BreaksTable
          data={breaks}
          loading={breaksLoading}
          page={page}
          search={search}
          orderBy={orderBy}
          orderDir={orderDir}
          onPageChange={setPage}
          onSearchChange={(s) => { setSearch(s); setPage(1); }}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}
