import { useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RevenueChartRow = {
  Ship_Date: string;
  Forecast_Revenue: number | null;
};

type Point = {
  date: string;
  label: string;
  daily: number;
  accumulated: number;
  percent: number | null;
  expectedPercent: number;
  onPace: boolean;
};

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function isoDays(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const days: string[] = [];
  const cursor = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  for (let i = 0; cursor <= last && i < 185; i++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export default function RevenuePaceChart({ rows, startDate, endDate }: {
  rows: RevenueChartRow[];
  startDate: string;
  endDate: string;
}) {
  const [goalInput, setGoalInput] = useState("");
  const goal = Number(goalInput);
  const validGoal = goalInput.trim() !== "" && Number.isFinite(goal) && goal > 0;

  const data = useMemo<Point[]>(() => {
    const dates = isoDays(startDate, endDate);
    const byDay = new Map<string, number>();
    rows.forEach(r => {
      if (r.Forecast_Revenue === null) return;
      byDay.set(r.Ship_Date, (byDay.get(r.Ship_Date) ?? 0) + r.Forecast_Revenue);
    });
    let accumulated = 0;
    return dates.map((date, index) => {
      const daily = byDay.get(date) ?? 0;
      accumulated += daily;
      const expectedPercent = (index + 1) / dates.length * 100;
      const percent = validGoal ? accumulated / goal * 100 : null;
      return {
        date,
        label: date.slice(5).replace("-", "/"),
        daily,
        accumulated,
        percent,
        expectedPercent,
        onPace: percent !== null && percent >= expectedPercent,
      };
    });
  }, [rows, startDate, endDate, goal, validGoal]);

  const total = data.length ? data[data.length - 1].accumulated : 0;
  return <section className="warehouse-forecast-section" style={{
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)", padding: "1.15rem 1.4rem", minWidth: 0,
  }}>
    <h3>Revenue Forecast — evolución diaria</h3>
    <p className="warehouse-muted">Barras: importe programado por Ship Date. Línea: porcentaje acumulado de la meta capturada. Verde = avance acumulado igual o superior al ritmo lineal esperado; rojo = por debajo. No representa ventas reales facturadas.</p>
    <div style={{display:"flex", gap:16, flexWrap:"wrap", alignItems:"end", marginBottom:16}}>
      <label style={{display:"grid", gap:5}}>Meta del período (USD)
        <input aria-label="Meta del período en dólares" type="number" min="0.01" step="0.01"
          placeholder="Ingresa meta" value={goalInput} onChange={e => setGoalInput(e.target.value)}
          style={{padding:8, borderRadius:6, border:"1px solid var(--color-border)", background:"var(--color-bg)", color:"var(--color-text-primary)"}}/>
      </label>
      <div className="warehouse-metric"><span>Total programado</span><strong>{money(total)}</strong></div>
      <div className="warehouse-metric"><span>% de la meta</span><strong>{validGoal ? ((total / goal) * 100).toFixed(1) + "%" : "Meta pendiente"}</strong></div>
    </div>
    <div style={{width:"100%", height:380}}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{top:24,right:28,bottom:24,left:12}}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false}/>
          <XAxis dataKey="label" angle={-45} textAnchor="end" height={68} interval="preserveStartEnd" tick={{fontSize:11}}/>
          <YAxis yAxisId="usd" tickFormatter={v=>"$"+Number(v).toLocaleString("en-US",{notation:"compact"})} tick={{fontSize:11}} width={72}/>
          <YAxis yAxisId="pct" orientation="right" tickFormatter={v=>v+"%"} tick={{fontSize:11}} width={45} domain={[0, (max: number) => Math.max(100, Math.ceil(max / 20) * 20)]}/>
          <Tooltip formatter={(value, name) => {
            if (name === "Ingreso programado") return [money(Number(value)), name];
            if (name === "% acumulado de meta") return [Number(value).toFixed(1) + "%", name];
            return [String(value), String(name)];
          }} labelFormatter={label=>"Fecha: "+String(label)}/>
          <Bar dataKey="daily" name="Ingreso programado" yAxisId="usd" maxBarSize={36}>
            {data.map(item=><Cell key={item.date} fill={!validGoal ? "#64748b" : item.onPace ? "#00a84f" : "#e02d35"}/>)}
          </Bar>
          {validGoal && <Line type="monotone" yAxisId="pct" dataKey="percent" name="% acumulado de meta"
            stroke="#16c850" strokeWidth={2.5} dot={false} isAnimationActive={false}/>}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div style={{display:"flex", justifyContent:"center", gap:20, flexWrap:"wrap", fontSize:12}}>
      <span><span style={{color:"#00a84f"}}>■</span> Ritmo cumplido</span>
      <span><span style={{color:"#e02d35"}}>■</span> Bajo ritmo</span>
      <span><span style={{color:"#64748b"}}>■</span> Sin meta</span>
      <span><span style={{color:"#16c850"}}>━</span> % acumulado de meta</span>
    </div>
  </section>;
}
